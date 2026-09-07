// Toast工具函数，用于替代alert
// 支持多种类型：success、error、warning、info

let toastContainer: HTMLElement | null = null;

// 创建Toast容器
function createToastContainer(): HTMLElement {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 500px;
    `;
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

// 显示Toast
export function showToast(
  message: string,
  type: 'success' | 'error' | 'warning' | 'info' = 'info',
  duration: number = 3000
): void {
  const container = createToastContainer();
  
  const toastElement = document.createElement('div');
  toastElement.className = `toast toast--${type}`;
  toastElement.style.cssText = `
    padding: 16px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    display: flex;
    align-items: center;
    justify-content: space-between;
    animation: slideIn 0.3s ease-out;
    min-width: 300px;
    max-width: 500px;
  `;
  
  // 设置颜色
  const colors = {
    success: { background: '#d4edda', color: '#155724', border: '#c3e6cb' },
    error: { background: '#f8d7da', color: '#721c24', border: '#f5c6cb' },
    warning: { background: '#fff3cd', color: '#856404', border: '#ffeaa7' },
    info: { background: '#d1ecf1', color: '#0c5460', border: '#bee5eb' }
  };
  
  const color = colors[type];
  toastElement.style.background = color.background;
  toastElement.style.color = color.color;
  toastElement.style.border = `1px solid ${color.border}`;
  
  // 内容
  const content = document.createElement('div');
  content.className = 'toast-content';
  content.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
  `;
  
  const icon = document.createElement('span');
  icon.className = 'toast-icon';
  icon.textContent = type === 'success' ? '✓' : type === 'error' ? '✗' : type === 'warning' ? '⚠' : 'ℹ';
  icon.style.fontWeight = 'bold';
  icon.style.fontSize = '16px';
  
  const messageSpan = document.createElement('span');
  messageSpan.className = 'toast-message';
  messageSpan.textContent = message;
  
  content.appendChild(icon);
  content.appendChild(messageSpan);
  
  // 关闭按钮
  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.style.cssText = `
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
    opacity: 0.7;
    transition: opacity 0.2s;
  `;
  
  closeBtn.addEventListener('click', () => {
    toastElement.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => {
      if (container.contains(toastElement)) {
        container.removeChild(toastElement);
      }
    }, 300);
  });
  
  toastElement.appendChild(content);
  toastElement.appendChild(closeBtn);
  
  container.appendChild(toastElement);
  
  // 自动关闭
  if (duration > 0) {
    setTimeout(() => {
      if (container.contains(toastElement)) {
        toastElement.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
          if (container.contains(toastElement)) {
            container.removeChild(toastElement);
          }
        }, 300);
      }
    }, duration);
  }
}

// 显示成功提示
export function showSuccess(message: string, duration?: number): void {
  showToast(message, 'success', duration);
}

// 显示错误提示
export function showError(message: string, duration?: number): void {
  showToast(message, 'error', duration);
}

// 显示警告提示
export function showWarning(message: string, duration?: number): void {
  showToast(message, 'warning', duration);
}

// 显示信息提示
export function showInfo(message: string, duration?: number): void {
  showToast(message, 'info', duration);
}

// 关闭所有Toast
export function closeAllToasts(): void {
  const container = document.getElementById('toast-container');
  if (container) {
    container.innerHTML = '';
  }
}

// 添加CSS样式
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);