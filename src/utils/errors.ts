/**
 * Error para conflictos de negocio (HTTP 409).
 * Se lanza cuando un recurso ya existe o hay un duplicado.
 */
export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

/**
 * Error para recursos no encontrados (HTTP 404).
 * Se lanza cuando un recurso buscado no existe.
 */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}
