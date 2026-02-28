export const samplePolicyDsl = `POLICY "Baseline SaaS Policy"

RULE liability_cap
WHEN CLAUSE TYPE LIABILITY
REQUIRE /cap(?:ped)? liability/i
FORBID /unlimited liability/i
SEVERITY high
REMEDIATION "Add a negotiated liability cap with statutory carve-outs."
END

RULE privacy_transfer
WHEN CLAUSE TYPE PRIVACY
FORBID /share your data with partners|sell your data/i
SEVERITY medium
REMEDIATION "Constrain third-party data sharing to explicit lawful purposes."
END
`;

export const sampleContractText = `Limitation of Liability
The service is provided as-is and liability is unlimited for all losses.

Privacy Terms
We may share your data with partners for any business purpose.
`;
