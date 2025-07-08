// backend/middleware/errorMiddleware.js

const notFound = (req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    res.status(404);
    next(error);
};

const errorHandler = (err, req, res, next) => {
    // Sometimes you might get an error with a 200 status code, which doesn't make sense.
    // This line sets the status code to 500 (Internal Server Error) if it was 200.
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode);

    res.json({
        message: err.message,
        // In development mode, show the error stack for debugging.
        // In production, don't show the stack to the user.
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
};

module.exports = { notFound, errorHandler };