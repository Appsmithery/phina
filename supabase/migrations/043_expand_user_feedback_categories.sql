alter table public.user_feedback
  drop constraint if exists user_feedback_category_check;

alter table public.user_feedback
  add constraint user_feedback_category_check
  check (
    category in (
      'bug',
      'feature_request',
      'confusing',
      'general_feedback',
      'praise',
      'report_user_content',
      'report_ai_content'
    )
  );
