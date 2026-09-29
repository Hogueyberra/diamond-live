import { useEffect, useRef } from 'react';
import { X } from '@phosphor-icons/react';

export function Button({ children, variant = 'secondary', className = '', ...props }) {
  return <button type="button" className={`cl-btn cl-btn--${variant} ${className}`} {...props}>{children}</button>;
}
export function Modal({ title, children, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog.showModal();
    return () => { dialog.close(); if (previous?.isConnected) previous.focus(); else document.getElementById('coaching-main')?.focus(); };
  }, []);
  return <dialog className="cw-dialog" ref={ref} onCancel={(event) => { event.preventDefault(); onClose(); }} aria-labelledby="dialog-title" onClick={(event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.target === event.currentTarget && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) onClose();
  }}>
    <div className="cw-dialog-heading"><h2 id="dialog-title" className="cl-h2">{title}</h2><Button className="cw-icon-button" aria-label="Close dialog" onClick={onClose}><X size={20} /></Button></div>
    {children}
  </dialog>;
}
export function Field({ label, children }) { return <label className="cl-field"><span className="cl-label">{label}</span>{children}</label>; }
