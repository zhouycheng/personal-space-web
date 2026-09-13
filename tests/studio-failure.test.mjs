import assert from 'node:assert/strict';
import test from 'node:test';
import { StudioFailure, studioFailure, canRetryStudio } from '../src/components/studio/studioFailure.ts';

test('failure classification preserves the original error and only retries rendering once', () => {
  const cause=new TypeError('texture context unavailable');
  const error=studioFailure(cause,'initialization');
  assert.equal(error.cause,cause);
  assert.equal(error.message,cause.message);
  assert.equal(studioFailure(error,'module'),error);
  for(const stage of ['module','initialization','context-lost']) {
    assert.equal(canRetryStudio(new StudioFailure(stage,cause),false,false),false);
  }
  for(const stage of ['context','shader','render']) {
    const failure=new StudioFailure(stage,cause);
    assert.equal(canRetryStudio(failure,false,false),true);
    assert.equal(canRetryStudio(failure,true,false),false);
    assert.equal(canRetryStudio(failure,false,true),false);
  }
});
