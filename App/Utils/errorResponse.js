class ErrorResponse extends Error {
  constructor(message, code, statusCode = 500, options = {}) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.success = false;
    this.details = options.details || null;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      success: this.success,
      status: this.status,
      statusCode: this.statusCode,
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
      timestamp: this.timestamp,
    };
  }
}

export default ErrorResponse;