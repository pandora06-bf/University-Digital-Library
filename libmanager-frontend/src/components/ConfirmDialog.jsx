import { useEffect, useId, useRef } from 'react';
import { Button } from './Button';

export default function ConfirmDialog({ title, children, onClose, onConfirm, loading = false, confirmLabel = 'Xác nhận', danger = false }) {
  const dialog = useRef(null);
  const heading = useId();
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);
  return (
    <dialog ref={dialog} aria-labelledby={heading} onCancel={(event) => { event.preventDefault(); if (!loading) onClose(); }} className="m-auto w-[calc(100%_-_2rem)] max-w-md rounded-2xl border-0 p-6 shadow-xl backdrop:bg-slate-900/50">
      <h2 id={heading} className="text-xl font-semibold text-slate-900">{title}</h2>
      <div className="my-5 text-sm leading-6 text-slate-600">{children}</div>
      <div className="flex justify-end gap-3">
        <Button size="sm" variant="ghost" disabled={loading} onClick={onClose}>Quay lại</Button>
        <Button size="sm" variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </dialog>
  );
}
