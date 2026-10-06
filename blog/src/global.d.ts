declare global {
  interface Window {
    /** index.html 的内联脚本设置：当前主题是否仍跟随系统偏好。 */
    __fmFollowSystem?: boolean;
  }
}

export {};
