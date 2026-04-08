export type SetupPageCopyKey =
  | 'income_new'
  | 'income_edit'
  | 'fixed_costs'
  | 'spending_budget'
  | 'goal_pick'
  | 'goal_name'
  | 'goal_destination'
  | 'goal_target'

export interface SetupPageCopy {
  eyebrow: string
  title: string
  subtitle: string
  savingText: string
}

export const SETUP_PAGE_COPY: Record<SetupPageCopyKey, SetupPageCopy> = {
  income_new: {
    eyebrow: 'Income',
    title: 'How do you get paid?',
    subtitle: "This shapes your budget and what's left after spending.",
    savingText: 'Saving your income…',
  },
  income_edit: {
    eyebrow: 'Income',
    title: 'Update your income',
    subtitle: 'Update your salary and any extra income sources in one place.',
    savingText: 'Saving your income…',
  },
  fixed_costs: {
    eyebrow: 'Fixed costs',
    title: 'What do you have to pay every month?',
    subtitle: 'Add the bills and commitments that come back each month.',
    savingText: 'Saving your fixed expenses…',
  },
  spending_budget: {
    eyebrow: 'Budget',
    title: 'What needs a spending budget?',
    subtitle: 'Set amounts for the categories you spend from most often.',
    savingText: 'Saving your spending budget…',
  },
  goal_pick: {
    eyebrow: '',
    title: 'What are you saving for?',
    subtitle: '',
    savingText: 'Saving your goal…',
  },
  goal_name: {
    eyebrow: 'New goal',
    title: 'What would you call this goal?',
    subtitle: 'Give it a name that feels clear and personal.',
    savingText: 'Saving your goal…',
  },
  goal_destination: {
    eyebrow: 'Travel goal',
    title: 'Where to?',
    subtitle: 'A rough destination is enough to make the goal real.',
    savingText: 'Saving your goal…',
  },
  goal_target: {
    eyebrow: '',
    title: 'Set a target',
    subtitle: 'Pick the amount you want to work toward.',
    savingText: 'Saving your goal…',
  },
}
