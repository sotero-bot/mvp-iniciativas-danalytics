import { DomainError } from './DomainError';

export class ResourceNotFoundError extends DomainError {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`);
    this.name = 'ResourceNotFoundError';
  }
}
