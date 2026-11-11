import React from 'react';
import { AlertCircle, X } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

interface LeaveGuideModalProps {
  visible: boolean;
  onClose: () => void;
}

const LEAVE_STEPS = [
  {
    title: 'Check your balance',
    description: 'Confirm you have enough days for the leave type you need (annual, sick, etc.) directly on your dashboard.',
    actor: 'Employee',
  },
  {
    title: 'Submit application',
    description:
      'Fill in leave type, dates, and reason. Standard leave types require at least 14 days advance notice. Past dates are blocked.',
    actor: 'Employee',
  },
  {
    title: 'Approval chain',
    description:
      'Your request routes through the configured workflow: typically your first supervisor, then facility HR (or district/ministry approvers).',
    actor: 'Approvers',
  },
  {
    title: 'HR records update',
    description: 'After all approval stages complete, HR finalises the leave on your record and updates balances.',
    actor: 'HR Officer',
  },
];

export const LeaveGuideModal: React.FC<LeaveGuideModalProps> = ({ visible, onClose }) => {
  const { colors } = useTheme();

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-fade-in">
      <div
        className="w-full max-w-md rounded-t-3xl sm:rounded-2xl p-6 pb-8 max-h-[90vh] overflow-y-auto border-t sm:border shadow-2xl"
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
        }}
      >
        {/* Header */}
        <div
          className="flex justify-between items-center border-b pb-4 mb-6"
          style={{ borderColor: colors.border }}
        >
          <h3 className="text-lg font-bold" style={{ color: colors.text }}>
            How Leave Applications Work
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800"
          >
            <X size={20} style={{ color: colors.muted }} />
          </button>
        </div>

        {/* Steps */}
        <div className="space-y-6">
          {LEAVE_STEPS.map((step, idx) => (
            <div key={idx} className="flex items-start">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center mr-4 flex-shrink-0 text-sm font-black"
                style={{
                  backgroundColor: colors.primary,
                  color: colors.surface,
                }}
              >
                {idx + 1}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex justify-between items-center">
                  <h4 className="text-base font-bold" style={{ color: colors.text }}>
                    {step.title}
                  </h4>
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-100 dark:bg-zinc-800"
                    style={{ color: colors.muted }}
                  >
                    {step.actor}
                  </span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: colors.muted }}>
                  {step.description}
                </p>
              </div>
            </div>
          ))}

          {/* Advisory Notice */}
          <div className="p-4 rounded-xl flex items-start bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 mt-4">
            <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mr-3 mt-0.5" />
            <div className="flex-1 text-xs">
              <span className="font-bold text-amber-800 dark:text-amber-400 block mb-0.5">
                Special Emergency Situations
              </span>
              <span className="text-amber-700 dark:text-amber-300/80 leading-relaxed">
                Sick leave and bereavement requests waive the advance notification rule but require certified medical report documentation upon resuming duties.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

