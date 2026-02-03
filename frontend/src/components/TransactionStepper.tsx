
import React from 'react';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';

interface StepperProps {
  steps: {
    label: string;
    status: 'pending' | 'current' | 'completed' | 'error';
  }[];
}

export default function TransactionStepper({ steps }: StepperProps) {
  return (
    <div className="w-full py-4">
      <div className="flex items-center justify-between relative">
        {/* Connecting Line */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-gray-200 -z-10" />
        
        {steps.map((step, index) => (
          <div key={index} className="flex flex-col items-center gap-2 bg-white px-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
              step.status === 'completed' ? 'bg-green-500 border-green-500 text-white' :
              step.status === 'current' ? 'bg-blue-500 border-blue-500 text-white' :
              step.status === 'error' ? 'bg-red-500 border-red-500 text-white' :
              'bg-white border-gray-300 text-gray-300'
            }`}>
              {step.status === 'completed' ? <CheckCircle2 size={16} /> :
               step.status === 'current' ? <Loader2 size={16} className="animate-spin" /> :
               step.status === 'error' ? <span className="text-white font-bold">!</span> :
               <Circle size={16} />}
            </div>
            <span className={`text-xs font-medium whitespace-nowrap ${
              step.status === 'current' ? 'text-blue-600' :
              step.status === 'completed' ? 'text-green-600' :
              step.status === 'error' ? 'text-red-600' :
              'text-gray-400'
            }`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
