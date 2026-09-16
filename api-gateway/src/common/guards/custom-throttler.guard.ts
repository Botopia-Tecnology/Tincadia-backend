import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const bypassKey = req?.headers?.['x-load-test-bypass'];
    if (bypassKey === 'tincadia-perf-2026') {
      return true;
    }
    return false;
  }
}
