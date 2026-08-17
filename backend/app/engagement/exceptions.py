class AppError(Exception):
    status_code = 500
    code = "INTERNAL_ERROR"

    def __init__(self, message: str, details: list | None = None):
        self.message = message
        self.details = details or []
        super().__init__(message)


class NotFoundError(AppError):
    status_code = 404
    code = "NOT_FOUND"


class ForbiddenError(AppError):
    status_code = 403
    code = "FORBIDDEN"


class UnauthorizedError(AppError):
    status_code = 401
    code = "UNAUTHORIZED"


class ValidationFailedError(AppError):
    status_code = 422
    code = "VALIDATION_ERROR"


class ConflictError(AppError):
    status_code = 409
    code = "CONFLICT"
