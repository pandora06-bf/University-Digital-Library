import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';
import { userAccountHandlers } from './userAccount';

// userAccountHandlers (3-13, 4-13) đứng trước để thay các route ví / đặt trước mẫu cũ trong handlers.
export const worker = setupWorker(...userAccountHandlers, ...handlers);
