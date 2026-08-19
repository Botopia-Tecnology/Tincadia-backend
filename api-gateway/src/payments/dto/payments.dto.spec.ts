import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ChargeCardDto } from './payments.dto';

describe('ChargeCardDto', () => {
  it('accepts the payload produced by the Wompi card flow', async () => {
    const dto = plainToInstance(ChargeCardDto, {
      reference: 'TINC-20260818-ABC123',
      cardToken: 'tok_test_12345',
      acceptanceToken: 'acceptance-token',
      email: 'customer@example.com',
      installments: 1,
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('does not accept the obsolete plan payload on charge-card', async () => {
    const dto = plainToInstance(ChargeCardDto, {
      cardToken: 'tok_test_12345',
      userId: 'user-id',
      planId: 'plan-id',
      billingCycle: 'mensual',
      customerEmail: 'customer@example.com',
    });

    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors.some((error) => error.property === 'reference')).toBe(true);
    expect(errors.some((error) => error.property === 'acceptanceToken')).toBe(
      true,
    );
    expect(errors.some((error) => error.property === 'email')).toBe(true);
    expect(errors.some((error) => error.property === 'userId')).toBe(true);
    expect(errors.some((error) => error.property === 'planId')).toBe(true);
    expect(errors.some((error) => error.property === 'billingCycle')).toBe(
      true,
    );
    expect(errors.some((error) => error.property === 'customerEmail')).toBe(
      true,
    );
  });
});
