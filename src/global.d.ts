declare module 'jssip';

export { };

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    JSMpeg?: any;
  }
}
