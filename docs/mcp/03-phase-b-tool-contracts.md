# Phase B read-only tool contracts

| Tool | Read surface | Input bounds / notes |
| --- | --- | --- |
| `get_study_dashboard` | Today's real plan blocks, recorded sessions, due reviews, daily goal | Uses the account timezone; each list is capped at 100 and signals truncation. |
| `list_subjects` | User subjects | Up to 100; archived subjects excluded by default. |
| `list_topics` | Topic hierarchy and notes | Up to 100; optional subject filter; notes length limited. |
| `get_study_plan` | Planned blocks and topic context | Required ISO dates, inclusive range up to 31 days, up to 100 rows. |
| `list_due_reviews` | Pending review tasks and originating session context | Through date is at most 366 days from today; up to 100; no scheduling mutation. |
| `get_study_history` | Non-deleted study sessions | Up to 100; optional start/end filters; study notes length limited. |
| `get_question_performance` | Canonical counts, accuracy, study time, weekly trend, subject breakdown | Required ISO dates, up to 90 days; rejects ranges whose full source set exceeds safe 5,000-row caps. |
| `list_error_notes` | Non-deleted error notebook entries | Up to 100; optional status/subject filter; free text length-limited. |
| `list_exam_targets` | Active exam targets and their linked subjects/topics | Up to 50; no external edital lookup. |

All reads are scoped to the verified OAuth user and preserve database RLS. No tool creates, changes, archives, completes, snoozes, reorders, or deletes anything. Phase C is the first phase permitted to introduce a write surface.
