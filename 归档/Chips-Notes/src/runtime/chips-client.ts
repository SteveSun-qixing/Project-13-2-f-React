/**
 * 薯片 SDK 客户端单例
 */

import { createClient } from 'chips-sdk';
import type { Client } from 'chips-sdk';

export const chipsClient: Client = createClient();
