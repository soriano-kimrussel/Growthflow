/** Result of a form server action, rendered by <ActionForm>. */
export type ActionState = { ok?: boolean; error?: string; message?: string } | undefined;

export type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;
