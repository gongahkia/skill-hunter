"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  createPolicyRule,
  deletePolicyRule,
  fetchMyPolicyProfile,
  fetchPolicyRules,
  updateMyPolicyProfile,
  updatePolicyRule,
  type ClauseRequirement,
  type CreatePolicyRuleInput,
  type EnabledAgents,
  type PolicyProfile,
  type PolicyProvider,
  type PolicyRule,
  type PolicySeverity,
  type PolicyThresholds
} from "../../src/policy/api";

const providers: PolicyProvider[] = ["OPENAI", "ANTHROPIC", "GEMINI", "OLLAMA"];
const severities: PolicySeverity[] = ["critical", "high", "medium", "low", "info"];
const clauseRequirementOptions: Array<{ label: string; value: ClauseRequirement | null }> = [
  { label: "Any clause", value: null },
  { label: "Definitions", value: "DEFINITIONS" },
  { label: "Scope", value: "SCOPE" },
  { label: "Payment", value: "PAYMENT" },
  { label: "Term", value: "TERM" },
  { label: "Termination", value: "TERMINATION" },
  { label: "Liability", value: "LIABILITY" },
  { label: "Indemnity", value: "INDEMNITY" },
  { label: "IP", value: "IP" },
  { label: "Confidentiality", value: "CONFIDENTIALITY" },
  { label: "Privacy", value: "PRIVACY" },
  { label: "Governing law", value: "GOVERNING_LAW" },
  { label: "Dispute resolution", value: "DISPUTE_RESOLUTION" },
  { label: "Misc", value: "MISC" },
  { label: "Unknown", value: "UNKNOWN" }
];

type PolicyFormState = {
  defaultProvider: PolicyProvider;
  thresholds: PolicyThresholds;
  enabledAgents: EnabledAgents;
};

type RuleFormState = {
  clauseRequirement: ClauseRequirement | null;
  clauseSelector: string;
  requiredPattern: string;
  forbiddenPattern: string;
  allowException: boolean;
  active: boolean;
  priority: number;
};

const defaultNewRuleState: RuleFormState = {
  clauseRequirement: null,
  clauseSelector: "",
  requiredPattern: "",
  forbiddenPattern: "",
  allowException: false,
  active: true,
  priority: 100
};

function toFixedInputNumber(value: number) {
  return Number.isFinite(value) ? value.toString() : "0";
}

function toBoundedConfidence(value: string, fallback: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(1, Math.max(0, parsed));
}

function toPositiveInteger(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function fromProfile(profile: PolicyProfile): PolicyFormState {
  return {
    defaultProvider: profile.defaultProvider,
    thresholds: profile.thresholds,
    enabledAgents: profile.enabledAgents
  };
}

function fromRule(rule: PolicyRule): RuleFormState {
  return {
    clauseRequirement: rule.clauseRequirement,
    clauseSelector: rule.clauseSelector,
    requiredPattern: rule.requiredPattern ?? "",
    forbiddenPattern: rule.forbiddenPattern ?? "",
    allowException: rule.allowException,
    active: rule.active,
    priority: rule.priority
  };
}

function normalizeNewRuleInput(state: RuleFormState): CreatePolicyRuleInput {
  return {
    clauseRequirement: state.clauseRequirement,
    clauseSelector: state.clauseSelector,
    requiredPattern: state.requiredPattern,
    forbiddenPattern: state.forbiddenPattern,
    allowException: state.allowException,
    priority: state.priority
  };
}

function sortRules(items: PolicyRule[]) {
  return [...items].sort((left, right) => {
    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }

    return left.createdAt.localeCompare(right.createdAt);
  });
}

function hasRulePattern(state: RuleFormState) {
  return state.requiredPattern.trim().length > 0 || state.forbiddenPattern.trim().length > 0;
}

export default function PolicyProfilePage() {
  const [profile, setProfile] = useState<PolicyProfile | null>(null);
  const [formState, setFormState] = useState<PolicyFormState | null>(null);
  const [rules, setRules] = useState<PolicyRule[]>([]);
  const [newRule, setNewRule] = useState<RuleFormState>(defaultNewRuleState);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingRule, setIsCreatingRule] = useState(false);
  const [updatingRuleId, setUpdatingRuleId] = useState<string | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [rulesStatusMessage, setRulesStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadPolicyData() {
      setError(null);
      setStatusMessage(null);
      setRulesError(null);
      setRulesStatusMessage(null);
      setIsLoading(true);

      try {
        const [profileResponse, rulesResponse] = await Promise.all([
          fetchMyPolicyProfile(),
          fetchPolicyRules()
        ]);
        setProfile(profileResponse);
        setFormState(fromProfile(profileResponse));
        setRules(sortRules(rulesResponse));
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "POLICY_LOAD_FAILED";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    }

    void loadPolicyData();
  }, []);

  const canSaveProfile = useMemo(
    () => !isLoading && !isSaving && formState !== null,
    [isLoading, isSaving, formState]
  );

  const canCreateRule = useMemo(() => {
    return (
      !isLoading &&
      !isCreatingRule &&
      newRule.clauseSelector.trim().length > 0 &&
      hasRulePattern(newRule)
    );
  }, [isLoading, isCreatingRule, newRule]);

  async function handleSaveProfile() {
    if (!formState) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setStatusMessage(null);

    try {
      const updatedProfile = await updateMyPolicyProfile(formState);
      setProfile(updatedProfile);
      setFormState(fromProfile(updatedProfile));
      setStatusMessage("Policy profile saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "POLICY_PROFILE_UPDATE_FAILED");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateRule() {
    if (newRule.clauseSelector.trim().length === 0) {
      setRulesError("RULE_SELECTOR_REQUIRED");
      return;
    }

    if (!hasRulePattern(newRule)) {
      setRulesError("RULE_PATTERN_REQUIRED");
      return;
    }

    setIsCreatingRule(true);
    setRulesError(null);
    setRulesStatusMessage(null);

    try {
      const createdRule = await createPolicyRule(normalizeNewRuleInput(newRule));
      setRules((current) => sortRules([...current, createdRule]));
      setNewRule(defaultNewRuleState);
      setRulesStatusMessage("Policy rule created.");
    } catch (createError) {
      setRulesError(createError instanceof Error ? createError.message : "POLICY_RULE_CREATE_FAILED");
    } finally {
      setIsCreatingRule(false);
    }
  }

  async function handleUpdateRule(rule: PolicyRule) {
    if (rule.clauseSelector.trim().length === 0) {
      setRulesError("RULE_SELECTOR_REQUIRED");
      return;
    }

    const ruleState = fromRule(rule);

    if (!hasRulePattern(ruleState)) {
      setRulesError("RULE_PATTERN_REQUIRED");
      return;
    }

    setUpdatingRuleId(rule.id);
    setRulesError(null);
    setRulesStatusMessage(null);

    try {
      const updatedRule = await updatePolicyRule(rule.id, {
        expectedVersion: rule.version,
        clauseRequirement: rule.clauseRequirement,
        clauseSelector: rule.clauseSelector,
        requiredPattern: rule.requiredPattern ?? "",
        forbiddenPattern: rule.forbiddenPattern ?? "",
        allowException: rule.allowException,
        active: rule.active,
        priority: rule.priority
      });
      setRules((current) => sortRules(current.map((item) => (item.id === updatedRule.id ? updatedRule : item))));
      setRulesStatusMessage(`Saved rule ${updatedRule.id}.`);
    } catch (updateError) {
      setRulesError(updateError instanceof Error ? updateError.message : "POLICY_RULE_UPDATE_FAILED");
    } finally {
      setUpdatingRuleId(null);
    }
  }

  async function handleDeleteRule(ruleId: string) {
    setDeletingRuleId(ruleId);
    setRulesError(null);
    setRulesStatusMessage(null);

    try {
      await deletePolicyRule(ruleId);
      setRules((current) => current.filter((rule) => rule.id !== ruleId));
      setRulesStatusMessage(`Deleted rule ${ruleId}.`);
    } catch (deleteError) {
      setRulesError(deleteError instanceof Error ? deleteError.message : "POLICY_RULE_DELETE_FAILED");
    } finally {
      setDeletingRuleId(null);
    }
  }

  return (
    <main>
      <p>
        <Link href="/">Back to dashboard</Link>
      </p>
      <h1>Policy Profile</h1>
      {isLoading ? <p>Loading policy profile...</p> : null}
      {error ? <p>{error}</p> : null}
      {statusMessage ? <p>{statusMessage}</p> : null}
      {formState ? (
        <>
          <section>
            <h2>Default Provider</h2>
            <label>
              Provider
              <select
                disabled={isSaving}
                onChange={(event) =>
                  setFormState((current) =>
                    current
                      ? {
                          ...current,
                          defaultProvider: event.target.value as PolicyProvider
                        }
                      : current
                  )
                }
                value={formState.defaultProvider}
              >
                {providers.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section>
            <h2>Risk Thresholds</h2>
            <p>Set confidence cutoffs between 0 and 1.</p>
            <p>
              <label>
                Critical minimum confidence
                <input
                  disabled={isSaving}
                  max={1}
                  min={0}
                  onChange={(event) =>
                    setFormState((current) =>
                      current
                        ? {
                            ...current,
                            thresholds: {
                              ...current.thresholds,
                              criticalMinConfidence: toBoundedConfidence(
                                event.target.value,
                                current.thresholds.criticalMinConfidence
                              )
                            }
                          }
                        : current
                    )
                  }
                  step={0.01}
                  type="number"
                  value={toFixedInputNumber(formState.thresholds.criticalMinConfidence)}
                />
              </label>
            </p>
            <p>
              <label>
                High minimum confidence
                <input
                  disabled={isSaving}
                  max={1}
                  min={0}
                  onChange={(event) =>
                    setFormState((current) =>
                      current
                        ? {
                            ...current,
                            thresholds: {
                              ...current.thresholds,
                              highMinConfidence: toBoundedConfidence(
                                event.target.value,
                                current.thresholds.highMinConfidence
                              )
                            }
                          }
                        : current
                    )
                  }
                  step={0.01}
                  type="number"
                  value={toFixedInputNumber(formState.thresholds.highMinConfidence)}
                />
              </label>
            </p>
            <p>
              <label>
                Medium minimum confidence
                <input
                  disabled={isSaving}
                  max={1}
                  min={0}
                  onChange={(event) =>
                    setFormState((current) =>
                      current
                        ? {
                            ...current,
                            thresholds: {
                              ...current.thresholds,
                              mediumMinConfidence: toBoundedConfidence(
                                event.target.value,
                                current.thresholds.mediumMinConfidence
                              )
                            }
                          }
                        : current
                    )
                  }
                  step={0.01}
                  type="number"
                  value={toFixedInputNumber(formState.thresholds.mediumMinConfidence)}
                />
              </label>
            </p>
            <p>
              <label>
                Auto-escalate severity
                <select
                  disabled={isSaving}
                  onChange={(event) =>
                    setFormState((current) =>
                      current
                        ? {
                            ...current,
                            thresholds: {
                              ...current.thresholds,
                              autoEscalateSeverity: event.target.value as PolicySeverity
                            }
                          }
                        : current
                    )
                  }
                  value={formState.thresholds.autoEscalateSeverity}
                >
                  {severities.map((severity) => (
                    <option key={severity} value={severity}>
                      {severity}
                    </option>
                  ))}
                </select>
              </label>
            </p>
          </section>

          <section>
            <h2>Enabled Agents</h2>
            <p>
              <label>
                <input
                  checked={formState.enabledAgents.riskScanner}
                  disabled={isSaving}
                  onChange={(event) =>
                    setFormState((current) =>
                      current
                        ? {
                            ...current,
                            enabledAgents: {
                              ...current.enabledAgents,
                              riskScanner: event.target.checked
                            }
                          }
                        : current
                    )
                  }
                  type="checkbox"
                />{" "}
                Risk scanner
              </label>
            </p>
            <p>
              <label>
                <input
                  checked={formState.enabledAgents.missingClause}
                  disabled={isSaving}
                  onChange={(event) =>
                    setFormState((current) =>
                      current
                        ? {
                            ...current,
                            enabledAgents: {
                              ...current.enabledAgents,
                              missingClause: event.target.checked
                            }
                          }
                        : current
                    )
                  }
                  type="checkbox"
                />{" "}
                Missing clause
              </label>
            </p>
            <p>
              <label>
                <input
                  checked={formState.enabledAgents.ambiguity}
                  disabled={isSaving}
                  onChange={(event) =>
                    setFormState((current) =>
                      current
                        ? {
                            ...current,
                            enabledAgents: {
                              ...current.enabledAgents,
                              ambiguity: event.target.checked
                            }
                          }
                        : current
                    )
                  }
                  type="checkbox"
                />{" "}
                Ambiguity
              </label>
            </p>
            <p>
              <label>
                <input
                  checked={formState.enabledAgents.compliance}
                  disabled={isSaving}
                  onChange={(event) =>
                    setFormState((current) =>
                      current
                        ? {
                            ...current,
                            enabledAgents: {
                              ...current.enabledAgents,
                              compliance: event.target.checked
                            }
                          }
                        : current
                    )
                  }
                  type="checkbox"
                />{" "}
                Compliance
              </label>
            </p>
            <p>
              <label>
                <input
                  checked={formState.enabledAgents.crossClauseConflict}
                  disabled={isSaving}
                  onChange={(event) =>
                    setFormState((current) =>
                      current
                        ? {
                            ...current,
                            enabledAgents: {
                              ...current.enabledAgents,
                              crossClauseConflict: event.target.checked
                            }
                          }
                        : current
                    )
                  }
                  type="checkbox"
                />{" "}
                Cross-clause conflict
              </label>
            </p>
          </section>

          <p>
            <button disabled={!canSaveProfile} onClick={() => void handleSaveProfile()} type="button">
              {isSaving ? "Saving..." : "Save profile"}
            </button>
          </p>
        </>
      ) : null}

      <section>
        <h2>Policy Rules</h2>
        {rulesError ? <p>{rulesError}</p> : null}
        {rulesStatusMessage ? <p>{rulesStatusMessage}</p> : null}
        <article>
          <h3>Create Rule</h3>
          <p>
            <label>
              Clause type
              <select
                disabled={isCreatingRule}
                onChange={(event) =>
                  setNewRule((current) => ({
                    ...current,
                    clauseRequirement:
                      event.target.value.length > 0 ? (event.target.value as ClauseRequirement) : null
                  }))
                }
                value={newRule.clauseRequirement ?? ""}
              >
                {clauseRequirementOptions.map((option) => (
                  <option key={option.label} value={option.value ?? ""}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </p>
          <p>
            <label>
              Clause selector
              <input
                disabled={isCreatingRule}
                onChange={(event) =>
                  setNewRule((current) => ({
                    ...current,
                    clauseSelector: event.target.value
                  }))
                }
                value={newRule.clauseSelector}
              />
            </label>
          </p>
          <p>
            <label>
              Required clause pattern
              <input
                disabled={isCreatingRule}
                onChange={(event) =>
                  setNewRule((current) => ({
                    ...current,
                    requiredPattern: event.target.value
                  }))
                }
                value={newRule.requiredPattern}
              />
            </label>
          </p>
          <p>
            <label>
              Forbidden phrase pattern
              <input
                disabled={isCreatingRule}
                onChange={(event) =>
                  setNewRule((current) => ({
                    ...current,
                    forbiddenPattern: event.target.value
                  }))
                }
                value={newRule.forbiddenPattern}
              />
            </label>
          </p>
          <p>
            <label>
              Priority
              <input
                disabled={isCreatingRule}
                min={1}
                onChange={(event) =>
                  setNewRule((current) => ({
                    ...current,
                    priority: toPositiveInteger(event.target.value, current.priority)
                  }))
                }
                step={1}
                type="number"
                value={newRule.priority}
              />
            </label>
          </p>
          <p>
            <label>
              <input
                checked={newRule.allowException}
                disabled={isCreatingRule}
                onChange={(event) =>
                  setNewRule((current) => ({
                    ...current,
                    allowException: event.target.checked
                  }))
                }
                type="checkbox"
              />{" "}
              Allow exception handling
            </label>
          </p>
          <p>
            <button disabled={!canCreateRule} onClick={() => void handleCreateRule()} type="button">
              {isCreatingRule ? "Creating..." : "Create rule"}
            </button>
          </p>
        </article>

        {rules.length === 0 ? <p>No policy rules created.</p> : null}
        {rules.map((rule) => {
          const isUpdatingRule = updatingRuleId === rule.id;
          const isDeletingRule = deletingRuleId === rule.id;

          return (
            <article key={rule.id}>
              <h3>
                Rule {rule.id} (v{rule.version})
              </h3>
              <p>
                <label>
                  Clause type
                  <select
                    disabled={isUpdatingRule || isDeletingRule}
                    onChange={(event) =>
                      setRules((current) =>
                        current.map((item) =>
                          item.id === rule.id
                            ? {
                                ...item,
                                clauseRequirement:
                                  event.target.value.length > 0
                                    ? (event.target.value as ClauseRequirement)
                                    : null
                              }
                            : item
                        )
                      )
                    }
                    value={rule.clauseRequirement ?? ""}
                  >
                    {clauseRequirementOptions.map((option) => (
                      <option key={option.label} value={option.value ?? ""}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </p>
              <p>
                <label>
                  Clause selector
                  <input
                    disabled={isUpdatingRule || isDeletingRule}
                    onChange={(event) =>
                      setRules((current) =>
                        current.map((item) =>
                          item.id === rule.id
                            ? {
                                ...item,
                                clauseSelector: event.target.value
                              }
                            : item
                        )
                      )
                    }
                    value={rule.clauseSelector}
                  />
                </label>
              </p>
              <p>
                <label>
                  Required clause pattern
                  <input
                    disabled={isUpdatingRule || isDeletingRule}
                    onChange={(event) =>
                      setRules((current) =>
                        current.map((item) =>
                          item.id === rule.id
                            ? {
                                ...item,
                                requiredPattern: event.target.value
                              }
                            : item
                        )
                      )
                    }
                    value={rule.requiredPattern ?? ""}
                  />
                </label>
              </p>
              <p>
                <label>
                  Forbidden phrase pattern
                  <input
                    disabled={isUpdatingRule || isDeletingRule}
                    onChange={(event) =>
                      setRules((current) =>
                        current.map((item) =>
                          item.id === rule.id
                            ? {
                                ...item,
                                forbiddenPattern: event.target.value
                              }
                            : item
                        )
                      )
                    }
                    value={rule.forbiddenPattern ?? ""}
                  />
                </label>
              </p>
              <p>
                <label>
                  Priority
                  <input
                    disabled={isUpdatingRule || isDeletingRule}
                    min={1}
                    onChange={(event) =>
                      setRules((current) =>
                        current.map((item) =>
                          item.id === rule.id
                            ? {
                                ...item,
                                priority: toPositiveInteger(event.target.value, item.priority)
                              }
                            : item
                        )
                      )
                    }
                    step={1}
                    type="number"
                    value={rule.priority}
                  />
                </label>
              </p>
              <p>
                <label>
                  <input
                    checked={rule.allowException}
                    disabled={isUpdatingRule || isDeletingRule}
                    onChange={(event) =>
                      setRules((current) =>
                        current.map((item) =>
                          item.id === rule.id
                            ? {
                                ...item,
                                allowException: event.target.checked
                              }
                            : item
                        )
                      )
                    }
                    type="checkbox"
                  />{" "}
                  Allow exception handling
                </label>
              </p>
              <p>
                <label>
                  <input
                    checked={rule.active}
                    disabled={isUpdatingRule || isDeletingRule}
                    onChange={(event) =>
                      setRules((current) =>
                        current.map((item) =>
                          item.id === rule.id
                            ? {
                                ...item,
                                active: event.target.checked
                              }
                            : item
                        )
                      )
                    }
                    type="checkbox"
                  />{" "}
                  Rule is active
                </label>
              </p>
              <p>
                <button
                  disabled={isUpdatingRule || isDeletingRule}
                  onClick={() => void handleUpdateRule(rule)}
                  type="button"
                >
                  {isUpdatingRule ? "Saving..." : "Save rule"}
                </button>{" "}
                <button
                  disabled={isUpdatingRule || isDeletingRule}
                  onClick={() => void handleDeleteRule(rule.id)}
                  type="button"
                >
                  {isDeletingRule ? "Deleting..." : "Delete rule"}
                </button>
              </p>
            </article>
          );
        })}
      </section>

      {profile ? (
        <p>
          Last updated: <time dateTime={profile.updatedAt}>{new Date(profile.updatedAt).toLocaleString()}</time>
        </p>
      ) : null}
    </main>
  );
}
