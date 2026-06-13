"""
Claude tool schemas — defines the tools the agent can call.
These map 1:1 to the tool implementations in app/tools/.
See design/agent-tools.md for full specification.
"""

TOOL_SCHEMAS = [
    {
        "name": "search_comps",
        "description": (
            "Search for comparable property sales near the subject. "
            "Use structured filters (type, beds, radius, age). "
            "If total_found < 3, call expand_search next."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "radius_km":      {"type": "number",  "description": "Search radius in km. Start at 2.0."},
                "max_age_months": {"type": "integer", "description": "Max sale age in months. Start at 12."},
                "beds_flexible":  {"type": "boolean", "description": "Allow ±1 bedroom. Default false."},
                "type_adjacent":  {"type": "boolean", "description": "Include adjacent property types. Default false."},
                "limit":          {"type": "integer", "description": "Max results to return. Default 10."},
            },
            "required": [],
        },
    },
    {
        "name": "expand_search",
        "description": (
            "Relax one search constraint when results are thin (< 3 comps). "
            "Try strategies in order: radius → age → beds_plus_minus_one → type_adjacent. "
            "Apply at most 2 expansions total."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "strategy": {
                    "type": "string",
                    "enum": ["radius", "age", "beds_plus_minus_one", "type_adjacent"],
                    "description": "Which constraint to relax.",
                },
            },
            "required": ["strategy"],
        },
    },
    {
        "name": "calculate_adjustments",
        "description": (
            "Apply dollar adjustments to each comp's sale price to account for "
            "differences from the subject (size, bedrooms, bathrooms, age). "
            "Flags comps where total adjustment exceeds the configured threshold."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
            "description": "No input required — uses current comps and subject from context.",
        },
    },
    {
        "name": "get_market_context",
        "description": (
            "Get area-level market statistics (median price, days on market, "
            "price trend, market condition). Always call this before generating the report."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "radius_km": {"type": "number",  "description": "Radius for market stats. Default matches search radius."},
                "months":    {"type": "integer", "description": "Lookback period in months. Default 6."},
            },
            "required": [],
        },
    },
]
