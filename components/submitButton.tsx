"use client";

import { useFormStatus } from "react-dom";
import { useFormState } from 'react-dom';
import { Button, ButtonProps } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner"
import { startTransition, useActionState, useEffect, useState } from "react";
import { AnySchema } from 'yup'; // Assuming you're using Yup for validation

// Define the state type
export interface FormState {
  message?: string | null;
  error?: string | null;
}

// Define prop types
interface SubmitButtonProps {
  children: React.ReactNode;
  formAction: (prevState: FormState, formData: FormData) => Promise<FormState>;
  pendingText?: string;
  onResult?: (state: FormState) => void;
  validationSchema?: AnySchema;
  variant?: ButtonProps["variant"];
  className?: string;
  disabled?: boolean;  // Aggiungi questa riga

}

const initialState: FormState = {
  message: null,
  error: null
};

export function SubmitButton({
  children,
  formAction,
  pendingText,
  onResult,
  validationSchema,
  variant,
  className,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus()
  const [state, dispatch] = useActionState(formAction, initialState);

  const handleSubmit = async (formData: FormData) => {
    if (pending) return;
    // Convert FormData to a normal object
    const formObject: Record<string, FormDataEntryValue> = Object.fromEntries(formData.entries());

    if (validationSchema) {
      try {
        //TODO reanable this 
        // await validationSchema.validate(formObject, { abortEarly: false });
        dispatch(formData)
      } catch (validationErrors: any) {
        if (validationErrors.name === 'ValidationError') {
          const errorMessages = validationErrors.inner?.map((err: any) => err.message).join(', ') || validationErrors.message;
          toast("Validation Error", {
            description: errorMessages,
            duration: 5000,
          });
        } else {
          toast.error("Errore inatteso nella validazione.");
          console.error(validationErrors);
        }
      }
    } else {
      dispatch(formData)
    }
  };

  useEffect(() => {
    if (state.message) toast.success(state.message);
    else if (state.error) toast.error(state.error);
  }, [state.message, state.error]);
  
  return (
    <Button
      formAction={handleSubmit}
      aria-busy={pending}
      className={className}
      {...props}
      type="submit"
      disabled={pending || props.disabled}
    >
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {pending ? pendingText : children}
    </Button>
  );
}