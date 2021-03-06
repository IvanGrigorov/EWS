"use strict";

var SoapRequest = require('./SoapRequest');

function Message(service) {
    this._service = service;
    this._recipients = [];
	this._cc_recipients = [];
	this._bcc_recipients = [];
	this._id = null;
	this._syncState = null;
	this._defaultFields = [
		'item:Attachments'		
	];
	this._additionalFields = [];
	this._attachments = [];
	this._extendedProperties = [];
	this._inReplyTo = null;
}

Message.prototype.Bind = function (id) {
	this._id = id;
};

Message.prototype.setSyncState = function (syncState) {
	this._syncState = syncState;
};

Message.prototype.SendAndSaveCopy = function SendAndSaveCopy (callback) {
    this._messageDisposition = 'SendAndSaveCopy';
    this._sendSaveAction(callback);
};

Message.prototype.Send = function Send (callback) {
    this._messageDisposition = 'SendOnly';
    this._sendSaveAction(callback);
};

Message.prototype.Save = function Save (callback) {
    this._messageDisposition = 'SaveOnly';
    this._sendSaveAction(callback);
};

Message.prototype.addRecipient = function addRecipient(recipient) {
    this._recipients.push(recipient);
};

Message.prototype.addCCRecipient = function addCCRecipient(recipient) {
	this._cc_recipients.push(recipient);
}
Message.prototype.addBCCRecipient = function addCCRecipient(recipient) {
	this._bcc_recipients.push(recipient);
}

Message.prototype.setReplyTo = function setReplyTo(id, changeKey) {
	this._inReplyTo = {
		Id: id
	};

	if (changeKey) {
		this._inReplyTo.ChangeKey = changeKey;
	}

	return this;
};

Message.prototype.ReplyTo = function ReplyTo(callback) {
	var self = this,
		messageCollection = null;
	if (!this._inReplyTo.ChangeKey) {
		messageCollection = new MessageCollection(this._service);
		messageCollection.BindToItems([this._inReplyTo.Id]);

		messageCollection.Load(function (err, results) {
			if (err) {
				return callback(err, null);
			}

			self._inReplyTo.ChangeKey = results[0].Items.Message.ItemId.attributes.ChangeKey;
			
			var soapRequest = new SoapRequest('CreateItem',	{
				attributes: {
					MessageDisposition: 'SendAndSaveCopy'
				},
				Items: {
					ReplyToItem: {
						ReferenceItemId: {
							attributes: self._inReplyTo
						},
						NewBodyContent: {
							attributes: {
								BodyType: 'HTML'
							},
							$value: self.Body
						}
					}			
				}
			});

			self._service.execute(soapRequest, callback);
		});
	} else {
		
			var soapRequest = new SoapRequest('CreateItem',	{
				attributes: {
					MessageDisposition: 'SendAndSaveCopy'
				},
				Items: {
					ReplyToItem: {
						ReferenceItemId: {
							attributes: self._inReplyTo
						},
						NewBodyContent: {
							attributes: {
								BodyType: 'HTML'
							},
							$value: self.Body
						}
					}			
				}
			});

			self._service.execute(soapRequest, callback);
	}
};

Message.prototype.sendItemAction = function _sendSaveAction (callback) {
    var soapRequest = new SoapRequest('SendItem', {
    	attributes: {
    		SaveItemToFolder: true
    	},
        ItemIds: {
            ItemId: {
		        attributes: {
		            Id: this.ItemId,
		            ChangeKey: this.ChangeKey		     
		        }
            }
        }
    });
    this._service.execute(soapRequest, callback);
};

Message.prototype._sendSaveAction = function _sendSaveAction (callback) {
    var soapObj = {
        attributes: {
            MessageDisposition: this._messageDisposition
        },
        Items: {
            Message: {
            	Attachments: this._attachments.map(function (attachment) {
            		return {
            			FileAttachment: {
            				Name: attachment.Name,
            				IsInline: attachment.IsInline
            			}
            		};
            	}),
                ItemClass: 'IPM.Note',
                Subject: this.Subject,
                Body: {
                    attributes: {
                        BodyType: 'HTML'
                    },
                    $value: this.Body
                }
            }
        }
    };
	
	if (this._extendedProperties.length) {
		soapObj.Items.Message.ExtendedProperty = this._extendedProperties.map(function (prop) {return prop.toJSON()});
	}
	soapObj.Items.Message.ToRecipients = {};
	soapObj.Items.Message.ToRecipients.Mailbox = this._recipients.map(function (recipient) {
		return {
			EmailAddress: recipient
		};
	});

	if (this._cc_recipients.length) {
		soapObj.Items.Message.CcRecipients = {};
		soapObj.Items.Message.CcRecipients.Mailbox = this._cc_recipients.map(function (recipient) {
			return {
				EmailAddress: recipient
			};
		});
	}

	if (this._bcc_recipients.length) {
		soapObj.Items.Message.BccRecipients = {};
		soapObj.Items.Message.BccRecipients.Mailbox = this._bcc_recipients.map(function (recipient) {
			return {
				EmailAddress: recipient
			};
		});
	}

	soapObj.Items.Message.From = {
		Mailbox: {
			EmailAddress: this.From
		}
	};

	var soapRequest = new SoapRequest('CreateItem', soapObj);
    this._service.execute(soapRequest, callback);
};

Message.prototype.BindAttachment = function (attachment) {
	this._attachments.push(attachment);
	return this;	
};

Message.prototype.CreateAttachment = function (callback) {
	var soapRequest = new SoapRequest('CreateAttachment', {
        ParentItemId: {
	        attributes: {
	            Id: this.ItemId
	        }
        },
        Attachments: {
        	FileAttachment: this._attachments.map(function (file) {
        		if (file.isInline) {
		        	return {
	        			Name: file.name,
	        			ContentId: file.ContentId,
	        			IsInline: true,
	        			IsContactPhoto: false,
	        			Content: file.content
		        	};
	        	} else {
	        		return {
	        			Name: file.name,
	        			Content: file.content
		        	};
	        	}
        	})
        } 
    });
    this._service.execute(soapRequest, callback);
};

Message.prototype.GetAttachments = function (callback) {
	var attachmentsCollection = new AttachmentCollection(this._service);
	attachmentsCollection.BindToItems(this._attachments);
	
	attachmentsCollection.Load(function (err, results) {
		if (!err) {
			this.Attachments = results;
		}

		callback(err, results);
	}.bind(this));
};

Message.prototype.addExtendedProperty = function (property) {
	this._extendedProperties.push(property);
	return this;
};

function MessageCollection(service) {
	this._service = service;
	this._defaultFields = [
		'item:Attachments'
	];
	this._baseShape = 'Default';
	this._extendedProperties = [];
}

MessageCollection.prototype.addExtendedProperty = function (property) {
	this._extendedProperties.push(property);
	return this;
}

MessageCollection.prototype.BindToItems = function (items) {
	this._items = items;
}

MessageCollection.prototype.setBaseShape = function (baseShape) {
	this._baseShape = baseShape;
};

MessageCollection.prototype.Load = function (callback) {
	var soapObj = {
		ItemShape: {	
			BaseShape: this._baseShape,
			IncludeMimeContent: true,
			AdditionalProperties: {
				FieldURI: this._defaultFields.map(function (field) {
					return { attributes: { FieldURI: field } };
				})
			}
		},
		ItemIds: {
			ItemId: this._items.map(function (item) { 
					var _item = {};
					if (typeof item == 'string') {
						_item.attributes = {Id: item};
						return _item;
					}
					_item.attributes = {Id: item.Id};
					if (item.ChangeKey != '') {
						_item.attributes.ChangeKey = item.ChangeKey;
					}
					return _item;
					
				})
		}
	};
	if (this._extendedProperties.length) {
		soapObj.ItemShape.AdditionalProperties.ExtendedFieldURI = this._extendedProperties.map(function (property) {
			return {attributes:  property.getAttributes() };
		})
	}
	var soapRequest = new SoapRequest('GetItem', soapObj);
	this._service.execute(soapRequest, callback);
};

function AttachmentCollection(service) {
	this._service = service;
	this._items = [];
}

AttachmentCollection.prototype.BindToItems = function (items) {
	this._items = items;
};

AttachmentCollection.prototype.Load = function (callback) {
	var soapRequest = new SoapRequest('GetAttachment', {
		AttachmentIds: {
			AttachmentId: this._items.map(function (attachment) {
				return { attributes: attachment };
			})
		}
	});
	this._service.execute(soapRequest, callback);
}


Message.prototype.MessageCollection = MessageCollection;
Message.prototype.AttachmentCollection  = AttachmentCollection;

module.exports = Message;


