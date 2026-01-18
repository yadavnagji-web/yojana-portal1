
import React from 'react';

interface FormSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

const FormSection: React.FC<FormSectionProps> = ({ title, icon, children }) => {
  const id = `section-${title.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="space-y-4" aria-labelledby={id}>
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
        <span className="text-orange-500 text-lg" aria-hidden="true">{icon}</span>
        <h3 id={id} className="font-black text-slate-800 text-xs uppercase tracking-widest">{title}</h3>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {children}
      </div>
    </div>
  );
};

export default FormSection;
