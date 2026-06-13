COMMERCIAL_TOOL_SCHEMAS = [
    {
        "name": "search_commercial_comps",
        "description": (
            "Search for comparable commercial property sales from the database. "
            "Filter by asset class, location, and date. Returns comps with income data "
            "(NOI, implied cap rate, occupancy, lease type) where available."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "asset_class": {
                    "type": "string",
                    "enum": ["industrial", "office", "multifamily"],
                    "description": "Asset class to search",
                },
                "latitude":  {"type": "number"},
                "longitude": {"type": "number"},
                "radius_km": {
                    "type": "number",
                    "default": 3.0,
                    "description": "Search radius in kilometres",
                },
                "max_age_months": {
                    "type": "integer",
                    "default": 18,
                    "description": "Maximum sale age in months",
                },
                "building_class": {
                    "type": "string",
                    "enum": ["A", "B", "C"],
                    "description": "Building class filter (office only; omit for industrial/multifamily)",
                },
                "class_adjacent": {
                    "type": "boolean",
                    "default": False,
                    "description": "If true, include adjacent building classes (A↔B, B↔C)",
                },
                "limit": {"type": "integer", "default": 10},
            },
            "required": ["asset_class", "latitude", "longitude"],
        },
    },
    {
        "name": "expand_commercial_search",
        "description": (
            "Relax one search constraint when initial comp results are thin (< 3). "
            "Apply at most 2 expansions before generating the report."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "previous_params": {
                    "type": "object",
                    "description": "The parameters used in the previous search",
                },
                "strategy": {
                    "type": "string",
                    "enum": ["radius", "age", "class_adjacent"],
                    "description": (
                        "radius — double the search radius; "
                        "age — extend max_age_months by 6; "
                        "class_adjacent — include adjacent building classes"
                    ),
                },
            },
            "required": ["previous_params", "strategy"],
        },
    },
    {
        "name": "calculate_commercial_adjustments",
        "description": (
            "Apply CUSPAP-compliant adjustments to each comp's sale price to account "
            "for differences from the subject: size, age, and building class (office only). "
            "Flags any comp where total adjustments exceed 25% of sale price."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "subject": {
                    "type": "object",
                    "description": "Subject property attributes (asset_class, year_built, size fields, building_class)",
                },
                "comps": {
                    "type": "array",
                    "description": "Comp records from search_commercial_comps",
                },
            },
            "required": ["subject", "comps"],
        },
    },
    {
        "name": "calculate_income_value",
        "description": (
            "Run the Direct Capitalization income approach. "
            "Derives value from NOI using a cap rate selected from comparable sales "
            "and benchmarked against Altus Group Canadian Cap Rate Report Q4 2024. "
            "Returns income_value, cap_rate_applied, rationale, and a sensitivity table. "
            "Only call this if the subject has a known NOI."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "subject_noi": {
                    "type": "number",
                    "description": "Subject property annual NOI in dollars",
                },
                "asset_class": {"type": "string", "enum": ["industrial", "office", "multifamily"]},
                "city": {"type": "string"},
                "comps": {
                    "type": "array",
                    "description": "Adjusted comps — the tool extracts implied_cap_rate from each",
                },
                "building_class": {
                    "type": "string",
                    "enum": ["A", "B", "C"],
                    "description": "Building class for benchmark lookup (office only)",
                },
            },
            "required": ["subject_noi", "asset_class", "city", "comps"],
        },
    },
    {
        "name": "get_market_context",
        "description": (
            "Pull area-level market statistics for the subject location. "
            "For commercial, pass asset_class to get relevant vacancy and trend data."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "latitude":    {"type": "number"},
                "longitude":   {"type": "number"},
                "radius_km":   {"type": "number", "default": 5.0},
                "asset_class": {
                    "type": "string",
                    "enum": ["industrial", "office", "multifamily"],
                },
                "months":      {"type": "integer", "default": 12},
            },
            "required": ["latitude", "longitude", "asset_class"],
        },
    },
]
