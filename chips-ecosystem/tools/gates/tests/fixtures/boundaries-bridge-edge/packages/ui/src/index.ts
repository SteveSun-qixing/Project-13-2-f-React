/* 未放行对照面：packages/ui 规则允许集不含 @chips/bridge，运行时 import 必须仍拒。 */
import { ChipsError } from '@chips/bridge';

export const Unauthorized = ChipsError;
