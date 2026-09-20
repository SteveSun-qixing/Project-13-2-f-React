'use strict';
/** 加载即抛错夹具：模拟损坏 / 平台不匹配的原生产物。应判 `load-failed`。 */
throw new Error('模拟原生产物损坏：dlopen 失败');
