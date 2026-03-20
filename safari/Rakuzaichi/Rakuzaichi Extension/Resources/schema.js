var MessageSchema = {
  create(fields) {
    return {
      role: fields.role || 'unknown',
      content: fields.content || '',
      id: fields.id || '',
      timestamp: fields.timestamp || '',
      model: fields.model || '',
      platform: fields.platform || '',
      index: typeof fields.index === 'number' ? fields.index : -1,
      metadata: fields.metadata || {}
    };
  }
};
if (typeof module !== 'undefined') module.exports = MessageSchema;
