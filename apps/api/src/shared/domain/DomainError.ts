export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

export class BusinessRuleViolationError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'BusinessRuleViolationError';
  }
}
