// English shell strings.
// Flat keys ("group.name"), one per line, for easy human editing (intent DO-003).
// Module-feature strings arrive with their modules — only shell strings live here.
const en = {
  // Application chrome
  "app.title": "Drone Operations",

  // Navigation — order in the UI: Dashboard → Settings (intent DO-003 context notes)
  "nav.ariaLabel": "Main navigation",
  "nav.dashboard": "Dashboard",
  "nav.compliance": "Compliance",
  "nav.fleet": "Fleet",
  "nav.airspace": "Airspace",
  "nav.missions": "Missions",
  "nav.checklists": "Checklists",
  "nav.maintenance": "Maintenance",
  "nav.flightLog": "Flight Log",
  "nav.settings": "Settings",

  // Placeholder pages for not-yet-built modules
  "placeholder.comingInPhase": "Coming in Phase {{phase}}",
  "placeholder.description":
    "This module is part of the full V1 scope and will be built in a later phase.",
  "placeholder.backToDashboard": "Back to Dashboard",

  // Dashboard placeholder extras — demonstrates the Sun–Thu week helper
  "dashboard.thisWeek": "This week",
  "dashboard.workday": "Workday",
  "dashboard.weekend": "Weekend",

  // Settings page
  "settings.language.label": "Language",
  // Language option labels are shown in their own language in BOTH locales (standard practice).
  "settings.language.en": "English",
  "settings.language.he": "עברית",
  "settings.units.label": "Units",
  "settings.units.metric": "Metric",
  "settings.units.note": "V1 is metric-only.",
  "settings.alerts.title": "Alert lead times",
  "settings.alerts.description":
    "Days before an expiry at which each warning tier is raised. Stored now; the alerts engine arrives in a later phase.",
  "settings.alerts.first": "First warning (days)",
  "settings.alerts.second": "Second warning (days)",
  "settings.alerts.final": "Final warning (days)",
  "settings.save": "Save",
  "settings.saved": "Saved",
  "settings.saveError": "Could not save settings.",
  "settings.loadError": "Could not load settings from the server. Showing defaults.",

  // Backup & restore (DO-004)
  "backup.title": "Backup",
  "backup.description":
    "Creates a single archive of the database and all documents at the folder you choose.",
  "backup.destLabel": "Destination folder",
  "backup.destPlaceholder": "e.g. D:\\Backups",
  "backup.run": "Create backup",
  "backup.success": "Backup created:",
  "backup.error": "Backup failed.",
  "restore.title": "Restore",
  "restore.description":
    "Replaces ALL current data with the contents of a backup archive. This cannot be undone.",
  "restore.archiveLabel": "Backup archive path",
  "restore.archivePlaceholder": "e.g. D:\\Backups\\drone-ops-backup_2026-07-07_2030.zip",
  "restore.run": "Restore from backup",
  "restore.confirmPrompt":
    "Restore will permanently REPLACE all current data and documents with the backup's contents. Continue?",
  "restore.success": "Restore complete. Reloading…",
  "restore.error": "Restore failed.",

  // Regulations Ruleset editor (DO-010, FR-A5)
  "ruleset.entry.title": "Regulations Ruleset",
  "ruleset.entry.description":
    "Regulatory limits, change history, and verification dates. All modules read their limits from here.",
  "ruleset.entry.open": "Open Ruleset editor",
  "ruleset.title": "Regulations Ruleset",
  "ruleset.description":
    "A rule change here is a data edit — no code change. Values marked unverified have not yet been confirmed against official sources.",
  "ruleset.backToSettings": "Back to Settings",
  "ruleset.loadError": "Could not load the Ruleset from the server.",
  "ruleset.unverified": "Unverified",
  "ruleset.verifiedOn": "Verified {{date}}",
  "ruleset.markVerified": "Mark verified",
  "ruleset.edit": "Edit",
  "ruleset.save": "Save",
  "ruleset.cancel": "Cancel",
  "ruleset.valueLabel": "Value",
  "ruleset.noteLabel": "Change note (optional)",
  "ruleset.saveError": "Could not save the change.",
  "ruleset.verifyError": "Could not mark the rule as verified.",
  "ruleset.history.show": "History",
  "ruleset.history.hide": "Hide history",
  "ruleset.history.empty": "No changes recorded.",
  "ruleset.value.true": "Yes",
  "ruleset.value.false": "No",
  "ruleset.value.unset": "Not set",
  "ruleset.category.ALTITUDE": "Altitude",
  "ruleset.category.DISTANCE": "Distances",
  "ruleset.category.OPERATIONAL": "Operational",
  "ruleset.category.LICENSING": "Licensing",
  "ruleset.category.PERMITS": "Permits",
  "ruleset.category.WEIGHT": "Weight",
  // Rule labels mirror the seeded catalog (prisma/ruleset-seed.ts); the DB
  // label is the fallback for rules without a translation here.
  "ruleset.rule.max_altitude_agl_m": "Maximum altitude above ground level",
  "ruleset.rule.min_distance_people_structures_m": "Minimum distance from people and structures",
  "ruleset.rule.airport_buffer_km": "Airport / airfield buffer",
  "ruleset.rule.vlos_required": "Visual line of sight required",
  "ruleset.rule.daylight_only": "Daylight operations only",
  "ruleset.rule.min_registration_age_years": "Minimum registration age",
  "ruleset.rule.moc_frequency_license_required": "MoC frequency license required",
  "ruleset.rule.permit_fee_recreational_nis": "Recreational permit fee",
  "ruleset.rule.permit_turnaround_hours_min": "Permit turnaround (minimum)",
  "ruleset.rule.permit_turnaround_hours_max": "Permit turnaround (maximum)",
  "ruleset.rule.registration_weight_threshold_g": "Registration weight threshold",
  "ruleset.rule.cvfr_lane_halfwidth_km": "CVFR lane corridor half-width",

  // Offline map & elevation (DO-012, FR-C1/C2/C5)
  "nav.map": "Map",
  "map.title": "Map",
  "map.description": "Offline map of Israel. Click the map or enter coordinates to place a pin.",
  "map.loading": "Loading map status…",
  "map.statusError": "Could not reach the local server for map status.",
  "map.missing.title": "Offline map package not installed",
  "map.missing.body":
    "An offline map tile package is not installed. You can build it for offline field use per the README instructions. In the meantime, the app runs using online tiles when connected.",
  "map.missing.vectorBody":
    "The installed tile package holds vector tiles, which this app cannot display. Rebuild it as raster (PNG) tiles per the README instructions to use it offline.",
  "map.missing.recheck": "Check again",
  "map.status.offline": "Offline package",
  "map.status.online": "Online — requires connection",
  "map.status.noSource": "No map source",
  "map.unavailable.title": "Map unavailable",
  "map.unavailable.body": "No offline map data on this device and no connection. The map will load automatically when a connection is available.",
  "map.settings.overrideLabel": "Map Source",
  "map.settings.mode.auto": "Automatic (prefer offline)",
  "map.settings.mode.offline": "Offline only",
  "map.settings.mode.online": "Online only",
  "map.entry.label": "Coordinates (decimal or DMS)",
  "map.entry.placeholder": `31.771959, 35.217018 or 31° 46' 19.05" N, 35° 13' 1.26" E`,
  "map.entry.go": "Move pin",
  "map.entry.error": "Could not read these coordinates — use decimal degrees or DMS.",
  "map.search.label": "Place / Address search",
  "map.search.placeholder": "Type address or place name...",
  "map.search.go": "Search",
  "map.search.offline": "Place search is unavailable. Check your internet connection.",
  "map.search.rateLimit": "Search rate limit exceeded. Please wait a second and try again.",
  "map.search.error": "Place search failed.",
  "map.search.noResults": "No places found matching this query.",
  "map.search.attribution": "Search by Nominatim (OSM contributors)",
  "map.pin.title": "Pinned point",
  "map.pin.none": "No pin yet — click the map or enter coordinates.",
  "map.pin.decimal": "Decimal",
  "map.pin.dms": "DMS",
  "map.elevation.label": "Terrain elevation",
  "map.elevation.loading": "Looking up elevation…",
  "map.elevation.value": "{{value}} m",
  "map.elevation.approximate": "Approximate",
  "map.elevation.approximateNote":
    "From a ~30 m surface model (typically ±4 m). Never precise; planning must round conservatively.",
  "map.elevation.missing":
    "Elevation data is not available offline. It will be downloaded automatically when connected.",
  "map.elevation.downloading":
    "Downloading elevation data: {{downloaded}}/{{total}} tiles ({{progress}}%)...",
  "map.elevation.downloadFailed": "Elevation download failed: {{error}}",
  "map.elevation.downloadRetry": "Retry download",
  "map.elevation.downloadOffline":
    "Elevation download will complete automatically when connected.",
  "map.elevation.outOfCoverage": "Outside the installed elevation tiles.",
  "map.elevation.error": "Elevation lookup failed.",
  "map.crosscheck.run": "Cross-check online",
  "map.crosscheck.failed": "Online cross-check unavailable (offline, or the provider did not answer).",
  "map.crosscheck.note":
    "Optional online sanity check via Open Topo Data (SRTM 30 m). Runs only when you press the button.",
  // OSM data attribution (ODbL) — kept in Latin script in both locales.
  "map.attributionFallback": "© OpenStreetMap contributors",
 
  // Zone overlays, legend, layer toggles (DO-014, FR-C1/FR-C4)
  "map.zones.title": "Zone layers",
  "map.zones.loading": "Loading zone layers…",
  "map.zones.error": "Could not load zone layers from the local server.",
  "map.zones.empty.title": "No zone data imported",
  "map.zones.empty.body":
    "Zone layers are missing or currently importing. They will automatically import on boot when available.",
  "map.zones.layerZoneCount": "{{n}} zones",
  "map.zones.imported": "Imported {{date}}",
  "map.zones.unverifiedNote":
    "Zone data has not yet been visually verified against the official charts — treat every overlay as unverified.",
  "map.zones.legend.title": "Legend",
  "map.zones.legend.lane": "CVFR flight lane",
  "map.zones.legend.clearContext":
    "No zone at a point = clear — the standard regulatory limits still apply.",
  "map.zones.verdict.RESTRICTED": "Restricted (no-fly)",
  "map.zones.verdict.NEEDS_PERMIT": "Needs permit",
  "map.zones.verdict.CLEAR": "Clear",
  "map.zones.popup.band": "Altitude band",
  "map.zones.popup.directional": "Directional altitudes (as published)",
  "map.zones.popup.envelopeNote":
    "Band shown is the min/max envelope of the published directional altitudes.",
  "map.zones.popup.source": "Source",
  // Altitude-band value texts — semantics per server/docs/zones-api.md.
  "map.zones.band.range": "{{floor}} – {{ceiling}}",
  "map.zones.band.ground": "GND (surface)",
  "map.zones.band.unbounded": "Unbounded (UNL)",
  "map.zones.band.amsl": "{{ft}} ft AMSL",
  "map.zones.band.agl": "{{ft}} ft AGL (as published)",
  "map.zones.band.notPublished": "Not published",
  "map.zones.band.noVerticalClaim": "No published altitude band",

  // Location-check verdict panel (DO-015, FR-C2/C3/C5/C6).
  // The card renders what the engine returns (server/docs/verdict-api.md) —
  // no regulatory value is hard-coded here. Reuses the zones verdict-tier,
  // altitude-band, rule-label and unverified/approximate strings above.
  "map.check.title": "Location check",
  "map.check.prompt":
    "Drop a pin on the map or enter coordinates, then check whether you can fly there.",
  "map.check.altitude.label": "Planned altitude (optional)",
  "map.check.altitude.placeholder": "e.g. 50",
  "map.check.altitude.hint":
    "Metres above ground level. Leave blank for a horizontal-only check.",
  "map.check.altitude.error": "Enter a planned altitude as a non-negative number of metres.",
  "map.check.run": "Check location",
  "map.check.running": "Checking…",
  "map.check.checkedAt": "Checked {{date}}",
  "map.check.error.title": "Location check could not be completed",
  "map.check.error.generic": "The check failed. Nothing here is a verdict — try again.",
  "map.check.clear.body":
    "No zone contains this point. The standard regulatory limits below still apply.",
  "map.check.units.m": "m",
  "map.check.reasons.title": "Why",
  "map.check.reasonKind.POINT_IN_ZONE": "The point is inside this zone",
  "map.check.reasonKind.WITHIN_AIRPORT_BUFFER_RULE": "Within the airport / airfield buffer",
  "map.check.reasonKind.WITHIN_LANE_CORRIDOR": "Within the flight-lane corridor",
  "map.check.reasonKind.CVFR_OVERHEAD": "CVFR flight lane overhead",
  "map.check.vertical.label": "Vertical",
  "map.check.vertical.status.CONFLICT":
    "Planned altitude conflicts with the zone's altitude band",
  "map.check.vertical.status.BELOW_FLOOR": "Planned altitude is below the band floor",
  "map.check.vertical.status.ABOVE_CEILING": "Planned altitude is above the band ceiling",
  "map.check.vertical.status.NO_CLAIM": "No published altitude band — no vertical statement",
  "map.check.vertical.clearance": "clearance {{ft}} ft",
  "map.check.vertical.groundReaching": "ground-reaching",
  "map.check.vertical.unbounded": "unbounded above (UNL)",
  "map.check.vertical.title": "Vertical separation",
  "map.check.vertical.plannedLabel": "Planned altitude",
  "map.check.vertical.aglUnit": "m AGL",
  "map.check.vertical.interval": "Compared as",
  "map.check.vertical.ftAmsl": "ft AMSL",
  "map.check.vertical.conservativeNote":
    "Elevation is approximate, so the compared altitude is widened by the uncertainty — conflicts are never narrowed away.",
  "map.check.vertical.allowedHeightAdvisory": "CVFR lane overhead — allowed height up to {{height}} m AGL (approximate)",
  "map.check.vertical.noAltitude": "Enter a planned altitude above to check vertical separation.",
  "map.check.distance.title": "Distances",
  "map.check.distance.nearestAirport": "Nearest airport / airfield",
  "map.check.distance.bufferWarning": "Inside the airport buffer of {{name}} ({{m}} m radius).",
  "map.check.distance.insideImportedBuffer": "Inside the imported airport buffer polygon.",
  "map.check.lanes.title": "CVFR flight lanes",
  "map.check.lanes.nearest": "Nearest lane",
  "map.check.lanes.centerlineDistance": "Distance to centerline",
  "map.check.lanes.withinCorridor": "inside the lane corridor",
  "map.check.context.title": "Standard limits still apply",
  "map.check.context.imported": "Values read {{date}}.",
  "map.check.dq.notAuthoritative":
    "Operator-maintained information — not legal advice or an ATC clearance. Verify against the official charts and NOTAMs before flying.",
  "map.check.dq.unverifiedLayers": "Unverified zone layers: {{layers}}.",
  "map.check.dq.unverifiedRules": "Unverified regulatory values: {{rules}}.",
  "map.check.dq.elevationApproximate":
    "Terrain elevation is approximate (~±4 m); vertical findings are widened conservatively.",

  // PIN login (DO-005)
  "auth.setupTitle": "Choose a PIN",
  "auth.setupDescription": "The PIN locks this app on this computer. Use 4–12 digits.",
  "auth.loginTitle": "Enter your PIN",
  "auth.pinLabel": "PIN",
  "auth.confirmPinLabel": "Confirm PIN",
  "auth.setPin": "Set PIN",
  "auth.unlock": "Unlock",
  "auth.pinMismatch": "The PINs do not match.",
  "auth.serverError": "Could not reach the local server.",
  "auth.resetHint": "Forgot your PIN? The README documents the reset command.",
  "auth.changeTitle": "Change PIN",
  "auth.currentPinLabel": "Current PIN",
  "auth.newPinLabel": "New PIN",
  "auth.confirmNewPinLabel": "Confirm new PIN",
  "auth.changeSubmit": "Change PIN",
  "auth.changed": "PIN changed.",

  // Dev-only upload test page (DO-005 scaffolding; replaced by the vault, DO-009)
  "devUploads.title": "Document upload test",
  "devUploads.devOnly": "Development-only page — the real document vault arrives in Phase 1.",
  "devUploads.upload": "Upload",
  "devUploads.empty": "No documents stored.",
  "devUploads.view": "View",
  "devUploads.delete": "Delete",
  "devUploads.uploaded": "Uploaded.",
  "devUploads.deleted": "Deleted.",
} as const;

export default en;
