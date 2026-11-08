import type { HeZhong } from './hezhong';
/** Open the drop-in mod manager panel; returns close(). 打开现成的模组管理面板，返回关闭函数。 */
export function mountPanel(hz: HeZhong, host?: HTMLElement, opt?: { lang?: 'en' | 'zh'; onChange?: () => void; onClose?: () => void }): () => void;
