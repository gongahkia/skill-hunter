"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  fetchMyPolicyProfile,
  updateMyPolicyProfile,
  type EnabledAgents,
  type PolicyProfile,
  type PolicyProvider,
  type PolicySeverity,
  type PolicyThresholds
} from "../../src/policy/api";

const providers: PolicyProvider[] = ["OPENAI", "ANTHROPIC", "GEMINI", "OLLAMA"];
const severities: PolicySeverity[] = ["critical", "high", "medium", "low", "info"];

type PolicyFormState = {
  defaultProvider: PolicyProvider;
  thresholds: PolicyThresholds;
  enabledAgents: EnabledAgents;
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

function fromProfile(profile: PolicyProfile): PolicyFormState {
  return {
    defaultProvider: profile.defaultProvider,
    thresholds: profile.thresholds,
    enabledAgents: profile.enabledAgents
  };
}

export default function PolicyProfilePage() {
  const [profile, setProfile] = useState<PolicyProfile | null>(null);
  const [formState, setFormState] = useState<PolicyFormState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      setError(null);
      setStatusMessage(null);
      setIsLoading(true);

      try {
        const response = await fetchMyPolicyProfile();
        setProfile(response);
        setFormState(fromProfile(response));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "POLICY_PROFILE_LOAD_FAILED");
      } finally {
        setIsLoading(false);
      }
    }

    void loadProfile();
  }, []);

  const canSubmit = useMemo(() => !isLoading && !isSaving && formState !== null, [isLoading, isSaving, formState]);

  async function handleSave() {
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
            <button disabled={!canSubmit} onClick={() => void handleSave()} type="button">
              {isSaving ? "Saving..." : "Save profile"}
            </button>
          </p>
        </>
      ) : null}
      {profile ? (
        <p>
          Last updated: <time dateTime={profile.updatedAt}>{new Date(profile.updatedAt).toLocaleString()}</time>
        </p>
      ) : null}
    </main>
  );
}
