export const MY_ORGS_QUERY = `
  query MyOrgs($userId: uuid!) {
    org_members(where: { user_id: { _eq: $userId } }) {
      role
      organization {
        id
        name
        slug
      }
    }
  }
`;

export const CREATE_ORG_MUTATION = `
  mutation CreateOrg($name: String!, $slug: String!) {
    insert_organizations_one(object: { name: $name, slug: $slug }) {
      id
      name
      slug
    }
  }
`;

export const ORG_USAGE_QUERY = `
  query OrgUsage($orgId: uuid!) {
    org_usage_current_period(where: { org_id: { _eq: $orgId } }) {
      org_id
      quota_calls_allowed
      quota_calls_used
      quota_calls_remaining
      runs_this_period
      failed_runs_this_period
      avg_run_duration_seconds
    }
  }
`;

export const WORKFLOWS_QUERY = `
  query Workflows($orgId: uuid!) {
    workflows(where: { org_id: { _eq: $orgId } }, order_by: { created_at: desc }) {
      id
      name
      description
      is_active
      avg_duration_seconds
      steps(order_by: { step_order: asc }) {
        id
        step_order
        type
        name
        config
      }
      triggers {
        id
        type
        is_enabled
        config
      }
      runs(order_by: { created_at: desc }, limit: 1) {
        id
        status
        created_at
        finished_at
      }
    }
  }
`;

export const CREATE_WORKFLOW_MUTATION = `
  mutation CreateWorkflow($orgId: uuid!, $name: String!, $description: String) {
    insert_workflows_one(object: { org_id: $orgId, name: $name, description: $description }) {
      id
    }
  }
`;

export const ADD_STEP_MUTATION = `
  mutation AddStep($object: workflow_steps_insert_input!) {
    insert_workflow_steps_one(object: $object) {
      id
    }
  }
`;

export const DELETE_STEP_MUTATION = `
  mutation DeleteStep($id: uuid!) {
    delete_workflow_steps_by_pk(id: $id) { id }
  }
`;

export const UPDATE_STEP_MUTATION = `
  mutation UpdateStep($id: uuid!, $name: String!, $config: jsonb!) {
    update_workflow_steps_by_pk(pk_columns: { id: $id }, _set: { name: $name, config: $config }) { id }
  }
`;

// Swaps two steps' step_order via a temporary value so the intermediate
// state never collides with the (workflow_id, step_order) unique
// constraint. All three updates ride in a single request, so Hasura runs
// them in one Postgres transaction -- either the whole swap lands or none
// of it does.
export const SWAP_STEP_ORDER_MUTATION = `
  mutation SwapStepOrder($stepAId: uuid!, $stepBId: uuid!, $orderA: Int!, $orderB: Int!, $temp: Int!) {
    toTemp: update_workflow_steps_by_pk(pk_columns: { id: $stepAId }, _set: { step_order: $temp }) { id }
    moveB: update_workflow_steps_by_pk(pk_columns: { id: $stepBId }, _set: { step_order: $orderA }) { id }
    moveA: update_workflow_steps_by_pk(pk_columns: { id: $stepAId }, _set: { step_order: $orderB }) { id }
  }
`;

export const ADD_TRIGGER_MUTATION = `
  mutation AddTrigger($object: workflow_triggers_insert_input!) {
    insert_workflow_triggers_one(object: $object) {
      id
    }
  }
`;

export const DELETE_TRIGGER_MUTATION = `
  mutation DeleteTrigger($id: uuid!) {
    delete_workflow_triggers_by_pk(id: $id) { id }
  }
`;

export const TRIGGER_WORKFLOW_RUN_MUTATION = `
  mutation TriggerWorkflowRun($workflowId: uuid!) {
    triggerWorkflowRun(input: { workflow_id: $workflowId }) {
      workflow_run_id
      status
    }
  }
`;

export const APPROVE_STEP_MUTATION = `
  mutation ApproveStep($stepRunId: uuid!, $decision: String!) {
    approveStep(input: { step_run_id: $stepRunId, decision: $decision }) {
      step_run_id
      workflow_run_id
      status
    }
  }
`;

export const STEP_RUNS_SUBSCRIPTION = `
  subscription StepRuns($workflowRunId: uuid!) {
    step_runs(where: { workflow_run_id: { _eq: $workflowRunId } }, order_by: { started_at: asc }) {
      id
      workflow_step_id
      status
      output
      error
      attempt_count
      approved_by
      approved_at
      started_at
      finished_at
      workflow_step {
        name
        type
        step_order
      }
    }
  }
`;

export const WORKFLOW_RUN_SUBSCRIPTION = `
  subscription WorkflowRun($runId: uuid!) {
    workflow_runs_by_pk(id: $runId) {
      id
      status
      error
      started_at
      finished_at
    }
  }
`;

export const ORG_MEMBERS_QUERY = `
  query OrgMembers($orgId: uuid!) {
    org_members(where: { org_id: { _eq: $orgId } }, order_by: { created_at: asc }) {
      id
      role
      created_at
      user {
        id
        display_name
        email
      }
    }
  }
`;

export const FIND_USER_BY_EMAIL_QUERY = `
  query FindUserByEmail($email: citext!) {
    auth_users(where: { email: { _eq: $email } }, limit: 1) {
      id
      display_name
      email
    }
  }
`;

export const INVITE_MEMBER_MUTATION = `
  mutation InviteMember($orgId: uuid!, $userId: uuid!, $role: String!) {
    insert_org_members_one(object: { org_id: $orgId, user_id: $userId, role: $role }) {
      id
    }
  }
`;

export const UPDATE_MEMBER_ROLE_MUTATION = `
  mutation UpdateMemberRole($id: uuid!, $role: String!) {
    update_org_members_by_pk(pk_columns: { id: $id }, _set: { role: $role }) { id }
  }
`;

export const REMOVE_MEMBER_MUTATION = `
  mutation RemoveMember($id: uuid!) {
    delete_org_members_by_pk(id: $id) { id }
  }
`;

export const RUN_HISTORY_QUERY = `
  query RunHistory($workflowId: uuid!) {
    workflow_runs(where: { workflow_id: { _eq: $workflowId } }, order_by: { created_at: desc }, limit: 10) {
      id
      status
      trigger_type
      started_at
      finished_at
      error
    }
  }
`;
