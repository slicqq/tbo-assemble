import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { authErrorMessage } from '../src/lib/auth-error';

test('auth errors provide actionable feedback without exposing raw server messages', () => {
  assert.match(authErrorMessage({code:'weak_password'}), /password doesn’t meet/);
  assert.match(authErrorMessage({code:'invalid_credentials'}), /Incorrect email or password/);
  assert.match(authErrorMessage({code:'over_request_rate_limit'}), /Too many attempts/);
  assert.match(authErrorMessage({name:'AuthRetryableFetchError'}), /Check your connection/);
  assert.doesNotMatch(authErrorMessage({message:'sensitive diagnostic'}), /sensitive diagnostic/);
});
