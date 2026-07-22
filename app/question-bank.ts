import parsed from "./questions.generated.json";

export type Domain = "A" | "B" | "C" | "D";
export type QuestionType = "single" | "hotspot" | "connect" | "order" | "numeric" | "multi";

export type Hotspot = { id: string; label: string; x: number; y: number; w: number; h: number };
export type BaseQuestion = {
  id: number;
  type: QuestionType;
  domain: Domain;
  task: string;
  topic: string;
  prompt: string;
  explanation: string;
  source: string;
  chapter: number;
  choices?: string[];
  answer?: number | number[] | string | string[];
  hotspots?: Hotspot[];
  steps?: string[];
  numericAnswer?: number;
  tolerance?: number;
  unit?: string;
  rationales?: string[];
  studyNote?: string;
  interactionRationale?: string;
};

const HOTSPOT_IDS = new Set([6, 18, 31, 44, 56, 74, 91, 102, 118, 149, 176, 190, 196, 203, 210, 217, 224, 231, 238, 245, 252, 259, 266, 273, 280, 287, 294]);
const CONNECT_IDS = new Set([5, 16, 34, 42, 59, 68, 85, 94, 111, 137, 152, 188, 198, 205, 212, 219, 226, 233, 240, 247, 254, 261, 268, 275, 282, 289, 295]);

const hotspotPositions = [
  { x: 5, y: 12, w: 42, h: 32 },
  { x: 53, y: 12, w: 42, h: 32 },
  { x: 5, y: 56, w: 42, h: 32 },
  { x: 53, y: 56, w: 42, h: 32 },
  { x: 28, y: 34, w: 44, h: 32 },
];

const sourceFor = (chapter: number, pages: string) =>
  `Official CTS Exam Guide, 3rd ed., Chapter ${chapter}, pp. ${pages}`;

const replacements: Record<number, Partial<BaseQuestion>> = {
  28: {
    type: "numeric", topic: "UHD display resolution", prompt: "A UHD image is 2,160 pixels high. Enter its standard horizontal pixel count.",
    numericAnswer: 3840, tolerance: 0, unit: "pixels", explanation: "Standard UHD is 3840 × 2160 pixels, so the horizontal count is 3,840.", source: sourceFor(5, "89-95"), chapter: 5,
  },
  49: {
    type: "numeric", topic: "IPv4 addressing", prompt: "Enter the total number of bits in one IPv4 address.",
    numericAnswer: 32, tolerance: 0, unit: "bits", explanation: "An IPv4 address contains four 8-bit octets: 4 × 8 = 32 bits.", source: sourceFor(6, "133-134"), chapter: 6,
  },
  90: {
    type: "order", topic: "Needs analysis sequence", prompt: "Put this customer-needs workflow in the strongest professional order.",
    steps: ["Identify stakeholders and communication objectives", "Gather user, workflow, budget, and constraint information", "Analyze conflicts, gaps, and priorities", "Document the agreed requirements and confirm them with the client"],
    explanation: "Needs analysis moves from identifying stakeholders and objectives, through information gathering and analysis, to documented client confirmation.", source: sourceFor(11, "199-214"), chapter: 11,
  },
  105: {
    type: "order", topic: "Site survey workflow", prompt: "Order the site-survey activities from preparation through reporting.",
    steps: ["Review available drawings and site-safety requirements", "Inspect the space and verify field conditions", "Measure and record dimensions, services, access, and constraints", "Reconcile discrepancies and issue the survey record"],
    explanation: "A survey is prepared from existing information, verified in the field, recorded accurately, and reconciled in a usable report.", source: sourceFor(12, "223-249"), chapter: 12,
  },
  129: {
    type: "order", topic: "Project scope", prompt: "Arrange the scope-development steps in the correct order.",
    steps: ["Confirm the communication objective and needs-analysis findings", "Define system functions, deliverables, and boundaries", "State assumptions, constraints, and exclusions", "Review and obtain client approval"],
    explanation: "A defensible scope starts with the objective, defines deliverables and boundaries, makes exclusions explicit, and is approved by the client.", source: sourceFor(15, "293-310"), chapter: 15,
  },
  135: {
    type: "numeric", topic: "Throw-distance ratio 0.8", prompt: "A projector is 4.0 m from the screen and its throw ratio is 0.8:1. Enter the image width.",
    numericAnswer: 5, tolerance: 0.01, unit: "m", explanation: "Throw ratio = throw distance ÷ image width. Therefore image width = 4.0 ÷ 0.8 = 5.0 m.", source: sourceFor(5, "112-114"), chapter: 5,
  },
  146: {
    type: "order", topic: "Cable installation", prompt: "Sequence the cable-installation workflow.",
    steps: ["Confirm the route, cable type, and current drawings", "Pull and dress the cable without exceeding limits", "Terminate using the specified method", "Label both ends and test the completed path"],
    explanation: "Correct installation follows verified documentation, protects the cable during the pull, then terminates, labels, and tests the path.", source: sourceFor(17, "367-389"), chapter: 17,
  },
  154: {
    type: "order", topic: "Mounting hardware", prompt: "Put these heavy-display mounting actions in the safest order.",
    steps: ["Confirm the approved location and load", "Verify structural support and select rated hardware", "Install and level the mount", "Attach and secure the display", "Inspect the completed assembly and document it"],
    explanation: "Location and load are confirmed first; structural support and rated hardware are verified before installation, attachment, and final inspection.", source: sourceFor(17, "395-402"), chapter: 17,
  },
  159: {
    type: "numeric", topic: "Throw-distance ratio 2.0", prompt: "A 2.0:1 lens must create a 3 m-wide image. Enter the required throw distance.",
    numericAnswer: 6, tolerance: 0.01, unit: "m", explanation: "Throw distance = throw ratio × image width = 2.0 × 3 m = 6 m.", source: sourceFor(17, "412-413"), chapter: 17,
  },
  162: {
    type: "order", topic: "Support troubleshooting", prompt: "Order the response to an end user reporting that a room has no image.",
    steps: ["Confirm the reported symptom and user context", "Check power, source selection, and obvious connections", "Trace the signal path and isolate the failed stage", "Restore operation, verify with the user, and record the resolution"],
    explanation: "Effective support confirms the symptom, checks simple causes, isolates along the signal path, and closes with verification and documentation.", source: sourceFor(18, "415-424"), chapter: 18,
  },
  164: {
    type: "multi", topic: "System closeout documentation", prompt: "Select every item that belongs in a useful AV system closeout package.",
    choices: ["Manufacturer manuals", "As-built drawings and signal paths", "Control and network configuration records", "End-user operating instructions", "Unapproved sales estimates"],
    answer: [0, 1, 2, 3], explanation: "Closeout documentation supports operation and troubleshooting through manuals, as-builts, configuration records, and audience-appropriate instructions.", source: sourceFor(18, "419-423"), chapter: 18,
  },
  171: {
    type: "order", topic: "Contract change control", prompt: "Order the response when a building change affects the contracted AV installation.",
    steps: ["Document the discrepancy and seek clarification", "Assess scope, cost, schedule, and technical impact", "Obtain written authorization through the required change process", "Update the controlled project documents and communicate the change"],
    explanation: "Contract obligations should not be changed informally. The discrepancy is documented, impacts are assessed, authorization is obtained, and controlled records are updated.", source: sourceFor(19, "438-442"), chapter: 19,
  },
  178: {
    type: "order", topic: "Preventive maintenance", prompt: "Sequence a planned preventive-maintenance visit.",
    steps: ["Review the maintenance plan and prior log", "Coordinate access and notify affected users", "Inspect, clean, update, and service the identified equipment", "Test system performance", "Record work, findings, and follow-up needs"],
    explanation: "Planned maintenance uses existing records, coordinated access, defined service tasks, performance testing, and a complete maintenance log.", source: sourceFor(20, "445-454"), chapter: 20,
  },
  183: {
    type: "order", topic: "Replacing failed components", prompt: "Put a component-replacement activity in the correct order.",
    steps: ["Confirm and isolate the failed component", "Verify warranty, compatibility, configuration, and authorization", "Safely remove and replace the component", "Restore configuration and test the complete system", "Update maintenance and asset records"],
    explanation: "Replacement begins with diagnosis and compatibility/authorization checks, then safe installation, full-system verification, and record updates.", source: sourceFor(21, "457-464"), chapter: 21,
  },
  192: {
    type: "order", topic: "Systematic troubleshooting", prompt: "Order the troubleshooting process for an intermittent display failure.",
    steps: ["Reproduce and define the symptom", "Check power, settings, connectors, and other simple causes", "Divide the signal path and test stage by stage", "Repair, reconfigure, or replace the isolated cause", "Retest under normal conditions and document the resolution"],
    explanation: "Troubleshooting is systematic: define, check the simple causes, isolate, correct, and verify/document.", source: sourceFor(22, "465-483"), chapter: 22,
  },
  193: {
    type: "numeric", topic: "Digital audio bandwidth", prompt: "A stereo audio stream uses 48 kHz sampling and 24-bit depth. Enter its uncompressed bit rate in Mbps.",
    numericAnswer: 2.304, tolerance: 0.001, unit: "Mbps", explanation: "48,000 samples/s × 24 bits/sample × 2 channels = 2,304,000 bps, or 2.304 Mbps.", source: sourceFor(3, "28-31"), chapter: 3,
  },
  88: {
    type: "multi", topic: "Needs-analysis inputs", prompt: "Select every category that should be gathered during a customer needs analysis.",
    choices: ["Communication objectives", "Stakeholder and end-user workflows", "Budget and schedule constraints", "Site and technology constraints", "A technician’s unapproved favorite product"],
    answer: [0, 1, 2, 3], explanation: "Needs analysis gathers objectives, stakeholders, workflows, budget/schedule, and constraints. Product preference does not replace validated requirements.", source: sourceFor(11, "199-214"), chapter: 11,
  },
};

const auditedOverrides: Record<number, Partial<BaseQuestion>> = {
  2: {
    prompt: "Which signal category can represent continuously varying values rather than only discrete states?",
    choices: ["Analog", "Binary", "Quantized", "Packetized digital"], answer: 0,
    explanation: "An analog signal varies continuously; binary, quantized, and packetized representations use discrete values or structures.",
  },
  6: {
    prompt: "In which signal path can a receiver decide whether each state is high or low and regenerate clean states before noise accumulates?",
    choices: ["Digital", "Unbalanced analog", "Balanced analog", "Baseband analog video"], answer: 0,
    explanation: "A digital receiver can interpret discrete states and regenerate them; analog paths can reject or reduce noise but normally reproduce the noise along with the wanted waveform.",
  },
  7: {
    prompt: "After many stages of amplification, which signal type normally carries accumulated noise forward with the wanted waveform rather than being regenerated as discrete states?",
    choices: ["Regenerated digital", "Analog", "Error-corrected digital", "Packetized data"], answer: 1,
    explanation: "Analog amplification raises both the wanted waveform and accumulated noise; properly recovered digital states can be regenerated within the system's operating limits.",
  },
  8: {
    prompt: "What term describes sound energy traveling through air from the source toward listeners?",
    choices: ["Generation", "Propagation", "Absorption", "Diffusion"], answer: 1,
    explanation: "Propagation is the travel of sound through a medium; generation creates it, absorption removes energy, and diffusion scatters reflections.",
  },
  18: {
    topic: "Balanced microphone cable termination",
    prompt: "A technician is terminating a standard balanced analog microphone cable at a mixer input. Which connector is the normal professional choice?",
    choices: ["3-pin XLR", "RCA", "75-ohm BNC", "8P8C modular connector"], answer: 0,
    explanation: "A standard balanced analog microphone connection normally uses a 3-pin XLR: two conductors carry the differential signal and the third contact connects the shield.",
  },
  24: {
    topic: "Incident-light measurement",
    prompt: "A metric project report requires the incident illumination measured at a projection screen. Which unit should the technician record?",
    choices: ["Lumens", "Nits", "Lux", "Kelvins"], answer: 2,
    explanation: "Lux measures incident illuminance in the SI system; lumens describe luminous flux, nits describe luminance, and kelvins describe color temperature.",
  },
  31: {
    topic: "Medical-center display requirements",
    prompt: "A medical center wants a display for reviewing fine-detail clinical images. What should the CTS establish before selecting the display?",
    choices: ["The largest display that fits the wall", "The clinical task, required detail, viewing conditions, workflow, and applicable requirements", "A consumer UHD model with the highest advertised contrast", "The lowest-cost display with an HDMI input"], answer: 1,
    explanation: "Display selection begins with the communication task and performance requirements, including image detail, viewing conditions, workflow, and any applicable clinical or regulatory criteria.",
    source: sourceFor(5, "98-118"), chapter: 5,
  },
  44: {
    topic: "MAC addressing",
    prompt: "Which identifier is associated with a network interface at the data-link layer and is used for local Ethernet delivery?",
    choices: ["MAC address", "IPv4 address", "Subnet mask", "DNS host name"], answer: 0,
    explanation: "A MAC address identifies a network interface for local data-link delivery; IP addresses support network-layer routing, a subnet mask defines the local prefix, and DNS resolves names.",
  },
  48: {
    topic: "Network-manager coordination",
    prompt: "Before assigning a static address to an AV endpoint on a client-managed network, what should the technician do?",
    choices: ["Choose any unused-looking address and document it later", "Obtain the approved IP settings and network requirements from the client’s network manager", "Enable a link-local 169.254.x.x address for permanent use", "Copy the address from a nearby device"], answer: 1,
    explanation: "Static addressing must be coordinated with the client’s network authority so the IP address, subnet, gateway, VLAN, and related settings do not conflict with network policy or other devices.",
  },
  21: {
    prompt: "In a conventional loudspeaker signal chain, which device normally follows the power amplifier?",
    choices: ["Equalizer", "Microphone preamplifier", "Signal processor", "Loudspeakers"], answer: 3,
    explanation: "The power amplifier supplies the amplified electrical signal to the loudspeakers; equalizers, preamplifiers, and signal processors normally operate earlier at lower signal levels.",
  },
  45: {
    prompt: "Which identifier does Internet Protocol use to name source and destination interfaces for delivery across IP networks?",
    choices: ["IP address", "DNS display name", "Ethernet switch-port label", "Manufacturer portion of a MAC address"], answer: 0,
    explanation: "IP uses source and destination IP addresses for network-layer delivery; DNS resolves names, MAC addresses support local data-link delivery, and port labels are administrative.",
  },
  47: {
    prompt: "What does an IPv4 subnet mask determine when it separates the network prefix from the host portion?",
    choices: ["The range and count of host addresses in the subnet", "The number of physical switch ports", "The DNS records allowed for each host", "The number of default gateways a device may store"], answer: 0,
    explanation: "The subnet mask defines the network and host portions of an IPv4 address, which establishes the subnet's address range and available host-address capacity.",
  },
  50: {
    topic: "Unmanaged network switches",
    prompt: "A small isolated AV network requires basic Ethernet forwarding with no switch configuration. Which switch type best fits that requirement?",
    choices: ["Unmanaged switch", "Managed Layer 2 switch", "Layer 3 switch", "Enterprise router"], answer: 0,
    explanation: "An unmanaged switch provides plug-and-play Ethernet forwarding; managed and Layer 3 devices are chosen when configuration, monitoring, segmentation, or routing is required.",
  },
  57: {
    topic: "Signal-distance limits",
    prompt: "A technician must confirm whether a proposed cable run will carry the required digital signal reliably. What is the best basis for the decision?",
    choices: ["Assume every digital signal is limited to 10 m", "Use the analog-cable limit for the same connector", "Check the signal format, bandwidth, cable performance, active devices, and manufacturer or standard distance limits", "Increase source level until the image appears"], answer: 2,
    explanation: "Digital transmission distance is system-specific and depends on signal format, data rate, cable and connector performance, active extension equipment, and published limits; it cannot be reduced to a universal analog-versus-digital rule.",
  },
  55: {
    prompt: "In common AV cabling terminology, which description best distinguishes a cable from an individual wire?",
    choices: ["A cable is an assembly of one or more insulated conductors or fibers within an overall construction", "A cable must always contain a metallic shield", "A cable contains exactly one uninsulated conductor", "A cable is any conductor carrying more than 50 volts"], answer: 0,
    explanation: "A cable is an overall assembly that can contain one or more insulated conductors or optical fibers plus jackets, fillers, shields, or strength members as required; an individual wire is a single conductor.",
  },
  62: {
    prompt: "A presenter should not have to operate the display, source, audio system, and room functions separately. What is the primary user-facing benefit of the control system?",
    choices: ["It increases the number of technical decisions the presenter makes", "It simplifies operation through a consistent interface and coordinated commands", "It replaces every device's internal firmware", "It removes the need to document system operation"], answer: 1,
    explanation: "A control system simplifies operation by presenting appropriate controls and coordinating commands; it does not replace device firmware or eliminate documentation.",
  },
  64: {
    prompt: "Which control command is most clearly a single device function rather than a programmed multi-device sequence?",
    choices: ["Recall presentation mode by powering displays, lowering screens, and selecting inputs", "Raise the program-audio level by one step", "Start conference mode by dialing, routing cameras, and recalling audio processing", "End the room session by stopping sources, muting audio, and running display cooldown"], answer: 1,
    explanation: "Raising one audio level by one step is a single function; the other commands coordinate several actions and are therefore programs or macros.",
  },
  65: {
    topic: "Control-system programming",
    prompt: "Which user command most clearly requires a control-system program or macro rather than a single device function?",
    choices: ["Start a presentation by powering the display, lowering the screen, selecting the source, and recalling the audio preset", "Raise one volume channel by one step", "Open one relay contact", "Read the current projector lamp-hours value"], answer: 0,
    explanation: "A program or macro coordinates multiple functions and devices in a defined sequence, whereas the other options are individual functions or status reads.",
  },
  74: {
    topic: "Equipment grounding conductor",
    prompt: "In an AC-powered AV installation, which conductor provides a low-impedance fault-current path from exposed equipment metal back toward the source?",
    choices: ["Ungrounded line conductor", "Grounded neutral conductor", "Equipment grounding conductor", "Audio signal reference conductor"], answer: 2,
    explanation: "The equipment grounding conductor bonds exposed conductive parts and provides a fault-current path so protective devices can operate; it is not the normal current-carrying neutral or an audio reference.",
  },
  95: {
    topic: "Stakeholder contact information",
    prompt: "Which contact list is most useful at the end of an initial client meeting?",
    choices: ["Only the person authorized to approve invoices", "Only the client’s technical representative", "Everyone who attended, regardless of project role", "The primary decision-maker plus the technical, IT, facilities, security, design, construction, and site contacts relevant to the work"], answer: 3,
    explanation: "The AV team needs both the principal client contact and the stakeholder contacts required to clarify needs, gain site access, coordinate systems, and complete installation work.",
  },
  97: {
    topic: "Site-specific safety requirements",
    prompt: "A client site requires PPE beyond the technician’s normal company minimum. Which approach is correct?",
    choices: ["Follow only the technician’s company policy", "Comply with applicable law, AHJ and employer rules, and the site-specific requirements", "Use the additional PPE only when the client is present", "Ask another trade to perform any task requiring extra PPE"], answer: 1,
    explanation: "Technicians must comply with all applicable regulatory, employer, and site-specific safety requirements; one source of rules does not cancel a more protective applicable requirement.",
  },
  106: {
    topic: "Architectural drawing abbreviations",
    prompt: "A wall-plate location is dimensioned vertically from the finished floor. Which drawing abbreviation identifies that reference?",
    choices: ["AFF", "NTS", "RCP", "NIC"], answer: 0,
    explanation: "AFF means above finished floor; NTS means not to scale, RCP means reflected ceiling plan, and NIC means not in contract.",
  },
  108: {
    topic: "Metric drawing scale",
    prompt: "On a 1:50 drawing, a wall measures 2 cm on the page. What is the full-size wall length?",
    choices: ["0.04 m", "0.4 m", "1 m", "100 m"], answer: 2,
    explanation: "At 1:50, 2 cm on the drawing represents 100 cm full size, which equals 1 m.",
  },
  109: {
    topic: "Imperial drawing scale",
    prompt: "A drawing uses a scale of 1/4 inch = 1 foot. A cable route measures 6 inches on the drawing. What is its full-size length?",
    choices: ["6 ft", "12 ft", "24 ft", "48 ft"], answer: 2,
    explanation: "Six inches contains twenty-four quarter-inch increments, and each increment represents 1 ft, so the route is 24 ft long.",
  },
  123: {
    topic: "AV control-room power",
    prompt: "Which assessment best supports planning AC power for an AV control room?",
    choices: ["Calculate AV load, identify other loads on the distribution, and verify available circuits and receptacles", "Count receptacles without checking circuit capacity", "Use equipment nameplate voltage only", "Assume the electrical contractor will add capacity after installation"], answer: 0,
    explanation: "Power planning considers the AV load, existing and shared distribution loads, circuit capacity, receptacle availability, and coordination with the electrical design.",
  },
  126: {
    topic: "HVAC noise control",
    prompt: "An audience room meets its temperature target, but air-handler noise masks quiet speech. What should the AV designer prioritize with the mechanical team?",
    choices: ["Reduce HVAC noise while preserving required ventilation and thermal performance", "Increase loudspeaker level without measuring background noise", "Disable ventilation during every presentation", "Relocate the AV controls beside the thermostat"], answer: 0,
    explanation: "HVAC design must meet environmental needs without creating background noise that compromises intelligibility; the solution is coordinated noise control, not simply more audio level or lost ventilation.",
  },
  137: {
    topic: "End-to-end system bandwidth",
    prompt: "How should a designer address bandwidth in a video signal path?",
    choices: ["Minimize bandwidth at every device to reduce cost", "Specify sufficient end-to-end bandwidth for the highest required format, with appropriate margin, and check the lowest-bandwidth element", "Maximize every component’s bandwidth regardless of requirements", "Evaluate only the source and display because intermediate devices do not affect bandwidth"], answer: 1,
    explanation: "The signal path must support the required format end to end, and its capability is limited by the lowest-bandwidth device or link; appropriate design margin is useful, but indiscriminate maximization is not the objective.",
  },
  144: {
    prompt: "During cable-termination quality control, which observation is a clear defect?",
    choices: ["Stray conductor strands extend beyond the intended terminal", "A soldered joint is smooth and has no bridge to adjacent contacts", "The jacket is stripped only to the specified preparation length", "A crimp is fully formed with the connector manufacturer's specified die"], answer: 0,
    explanation: "Stray conductor strands can short adjacent contacts and indicate poor workmanship; the other observations describe acceptable termination conditions when they follow the connector specification.",
  },
  145: {
    topic: "SDI signal connector",
    prompt: "A coaxial video cable uses a 75-ohm bayonet-lock connector for an SDI signal. Which connector is it?",
    choices: ["XLR", "8P8C", "BNC", "RCA"], answer: 2,
    explanation: "Professional SDI over coax commonly uses a 75-ohm BNC connector; XLR is commonly used for balanced audio, 8P8C for twisted-pair networking, and RCA for consumer unbalanced connections.",
  },
  151: {
    topic: "Mounting to a concrete ceiling",
    prompt: "Before mounting a projector to an existing concrete ceiling, what is the best installation approach?",
    choices: ["Use plastic expansion plugs sized by the installer", "Verify the structure and load, then use approved rated anchors and hardware in accordance with the design, manufacturer instructions, and required engineering", "Attach the mount to the ceiling finish because concrete is behind it", "Use any anchor whose advertised load exceeds the projector weight"], answer: 1,
    explanation: "Overhead mounting requires verified structure, total design load, approved rated hardware, correct installation, and any required structural review; the projector’s weight alone is not the complete design condition.",
  },
  157: {
    topic: "VLAN configuration",
    prompt: "Why can manually adding an AV VLAN across an existing switched network require substantial coordination?",
    choices: ["The VLAN, access ports, trunks, addressing, security policy, and switch configurations must remain consistent across the affected network", "A VLAN always encrypts every packet", "Every endpoint must use a public IP address", "VLANs require replacing copper cable with fiber"], answer: 0,
    explanation: "A VLAN deployment can touch multiple switches, trunks, access ports, addressing plans, and security controls, so it must be coordinated and configured consistently with the client’s network team.",
  },
  160: {
    topic: "Maintenance activity records",
    prompt: "Which maintenance-log entry is the most complete?",
    choices: ["Room checked - OK", "Projector replaced", "Date, technician, affected asset, reported condition, work performed, parts or configuration changes, test result, and follow-up", "A copy of the customer invoice only"], answer: 2,
    explanation: "A useful maintenance record identifies who did what, when, to which asset, why it was done, what changed, how operation was verified, and what remains outstanding.",
  },
  165: {
    topic: "AV system shutdown",
    prompt: "Which shutdown instruction should a technician give an end user?",
    choices: ["Switch off the room breaker after every meeting", "Follow the documented system-specific sequence and wait for required cool-down or confirmation steps", "Disconnect sources before using the control interface", "Turn off devices in any order as long as the display goes dark"], answer: 1,
    explanation: "AV systems should be shut down using the documented, system-specific sequence so dependent devices, cooling cycles, and controlled power actions complete safely.",
  },
  168: {
    type: "single", topic: "As-built drawings",
    prompt: "At project closeout, which document should show the signal paths, device locations, and field changes as they were actually installed?",
    choices: ["As-built drawings", "Original sales proposal", "Preliminary concept sketch", "Manufacturer price list"], answer: 0,
    explanation: "As-built drawings record the installed condition, including approved field changes, so future operators and technicians can support and troubleshoot the real system.",
  },
  173: {
    topic: "Request for information",
    prompt: "An installation drawing conflicts with a field condition, and the technician needs formal clarification before proceeding. Which document should be submitted?",
    choices: ["Request for information (RFI)", "Change order (CO)", "Purchase order (PO)", "Preventive-maintenance report"], answer: 0,
    explanation: "An RFI formally requests clarification of incomplete, conflicting, or unclear project information; a change order is used only when an authorized contractual change is required.",
  },
  87: {
    explanation: "Active listening centers on the speaker: focus, paraphrase, summarize, and use attentive nonverbal behavior. Steering the conversation toward the listener's preferred topic defeats that purpose.",
  },
  136: {
    explanation: "The designer first confirms every medium and source the client must present, then provides compatible inputs, transport, processing, control, and display paths for those requirements.",
  },
  139: {
    explanation: "Required frequency response follows the intended application: speech-only systems can be narrower than music systems. Do not maximize bandwidth or default to 20 Hz-20 kHz unless the client requirement calls for it.",
  },
  156: {
    explanation: "Reviewing the system design reveals the equipment, materials, crew skills, setup time, and sequencing needed to support the event reliably.",
  },
  170: {
    explanation: "A client-requested change that affects price or scope must be documented in a change order and approved by authorized representatives before the changed work proceeds.",
  },
  176: {
    explanation: "Inventory control must show what is on hand, what is on order and due, and what has been issued to each client site; receiving or warehouse capacity alone is incomplete.",
  },
  179: {
    explanation: "For rented equipment, verifying the identity and authorization of the person taking possession is the first theft-prevention control; operation and transport training address different risks.",
  },
  189: {
    explanation: "Divide-and-conquer localization tests the signal path near its midpoint, keeps the failed half, and repeats until the faulty stage is isolated; it usually requires fewer tests than checking every device in order.",
  },
  190: {
    explanation: "User action remains a valid hypothesis because an incorrect setting, source selection, connection, or operating step can create the reported symptom; verify it without blaming the user.",
  },
  194: {
    explanation: "Compression does not remove the acoustic loop that causes feedback. Improve gain-before-feedback by moving the microphone closer to the source, keeping loudspeakers in front of and away from microphones, and muting unused microphones.",
  },
  177: {
    topic: "Security screws",
    prompt: "A public-facing digital-signage player must resist casual tampering while remaining serviceable. Which hardware choice best fits?",
    choices: ["Permanent adhesive on every fastener", "Rated tamper-resistant security fasteners with the service tool controlled by authorized staff", "Standard hand-tightened thumb screws", "Unrated fasteners hidden behind tape"], answer: 1,
    explanation: "Tamper-resistant security fasteners deter casual removal while preserving authorized service access; the mounting and hardware must still meet load, environmental, and manufacturer requirements.",
    source: sourceFor(20, "445-454"), chapter: 20,
  },
  198: {
    topic: "Conflicting stakeholder requirements",
    prompt: "Two department leads request incompatible room workflows during discovery. What should the CTS do next?",
    choices: ["Choose the request that is easiest to implement", "Clarify the conflict, document both needs, and confirm who has decision authority", "Include both workflows without discussing cost or usability", "Ask the installation crew to decide after equipment arrives"], answer: 1,
    explanation: "Conflicting needs should be made explicit, traced to the affected stakeholders, and resolved by the authorized decision-maker before they become an undocumented design assumption.",
  },
  199: {
    topic: "Workflow observation",
    prompt: "Staff describe a complex room-booking and presentation process differently in interviews. Which discovery action is most useful?",
    choices: ["Observe representative users completing the real workflow and record exceptions", "Select products from the room dimensions alone", "Use the most senior person's description as the only requirement", "Delay discovery until installation begins"], answer: 0,
    explanation: "Direct observation exposes handoffs, exceptions, environmental constraints, and user behaviors that interviews alone may miss.",
  },
  200: {
    topic: "Needs before products",
    prompt: "A stakeholder begins discovery by naming a specific display model. What is the best response?",
    choices: ["Order the model immediately to protect the schedule", "Reject the model because products should never be discussed", "Ask what communication task, audience, content, environment, and outcome the display must support", "Specify the newest model from the same manufacturer"], answer: 2,
    explanation: "The CTS should translate a product preference into measurable functional needs before determining whether that or another product is appropriate.",
  },
  201: {
    topic: "Accessible user requirements",
    prompt: "When should accessibility needs such as assistive listening, readable controls, and caption visibility be addressed?",
    choices: ["During initial needs analysis with the affected users and applicable requirements", "Only after the system fails an acceptance test", "After installation if contingency remains", "Only when a specific product is selected"], answer: 0,
    explanation: "Accessibility is a user and system requirement that affects scope, interfaces, infrastructure, and verification, so it belongs in early discovery.",
  },
  202: {
    topic: "Requirements confirmation",
    prompt: "At the end of a needs interview, which action best reduces later misunderstandings?",
    choices: ["Read back the key needs, constraints, priorities, and open decisions, then document them for confirmation", "Keep only personal notes so stakeholders cannot change them", "Convert every preference directly into a mandatory requirement", "Wait for construction documents to reveal what users meant"], answer: 0,
    explanation: "A concise readback and documented confirmation create shared understanding while preserving unresolved items for follow-up.",
  },
  206: {
    topic: "Display-site measurements",
    prompt: "During a survey for a detailed-information display, which field data is most important to record for later display sizing and performance decisions?",
    choices: ["Representative viewing distances, audience positions, content detail, ambient light, available space, and sightline obstructions", "Only the wall paint manufacturer", "The number of receptacle cover screws", "Only the diagonal size of the client's current display"], answer: 0,
    explanation: "Display design depends on what users must see and from where, together with light, geometry, mounting space, and sightline constraints measured at the site.",
  },
  211: {
    topic: "Room-dimension verification",
    prompt: "A reflected ceiling plan shows a uniform 10-foot height, but the room contains soffits and a sloped ceiling. What should the site survey record?",
    choices: ["Measured heights at the relevant equipment and audience locations, the transitions, obstructions, and the drawing discrepancy", "Only the largest height shown on the drawing", "A single estimated average with no locations", "The floor area because vertical conditions do not affect AV work"], answer: 0,
    explanation: "Field measurements and located obstructions reveal the real geometry needed for mounting, sightlines, coverage, cable routing, and coordination.",
  },
  215: {
    topic: "Scope assumptions",
    prompt: "A probable cost depends on the client providing network ports and electrical circuits. How should the scope address this?",
    choices: ["List those provisions as explicit assumptions with responsible parties", "Omit them because another trade is involved", "Treat them as free contingency", "Add them only to an internal sales note"], answer: 0,
    explanation: "Explicit assumptions make the cost and responsibility basis visible and allow the team to manage the impact if an assumption proves false.",
  },
  216: {
    topic: "Scope exclusions",
    prompt: "Which statement is the clearest project-scope exclusion?",
    choices: ["The system will be easy to use", "Owner-furnished network switches and recurring carrier charges are not included", "Provide a complete AV system", "Coordinate with all necessary parties"], answer: 1,
    explanation: "A useful exclusion identifies specific work, equipment, or cost outside the AV provider's responsibility rather than using a broad aspiration.",
  },
  217: {
    topic: "Functional scope requirement",
    prompt: "Which scope statement is a functional requirement rather than a product prescription?",
    choices: ["Install model ZX-900 in every room", "Provide intelligible reinforcement for seated participants throughout the defined audience area", "Use the manufacturer's newest loudspeaker", "Purchase all equipment from one distributor"], answer: 1,
    explanation: "A functional requirement states the outcome and conditions the solution must satisfy; a named model or purchasing method prescribes an implementation.",
  },
  218: {
    topic: "Scope approval",
    prompt: "Before detailed design proceeds, what should establish the agreed baseline for system outcomes, boundaries, assumptions, and cost expectations?",
    choices: ["Documented approval by the authorized client representative", "A verbal comment from any future user", "The first equipment submittal", "An installer's field preference"], answer: 0,
    explanation: "Authorized approval creates a controlled scope baseline against which detailed design and later changes can be evaluated.",
  },
  219: {
    topic: "Interface responsibilities",
    prompt: "The AV system depends on power, data, millwork, and ceiling support by other trades. What belongs in the scope?",
    choices: ["Only the AV equipment list", "The required interfaces, responsible parties, timing, and acceptance conditions", "A note that coordination will happen later", "The names of installers but not their deliverables"], answer: 1,
    explanation: "Defining cross-trade interfaces and ownership prevents gaps where each party assumes another will provide a required condition.",
  },
  220: {
    topic: "Probable-cost uncertainty",
    prompt: "A concept estimate is prepared before field conditions and final quantities are known. How should it be presented?",
    choices: ["As a guaranteed final price", "With its basis, assumptions, exclusions, level of accuracy, and relevant contingency or risk", "Without supporting quantities so it cannot be challenged", "As equipment cost only, labeled total project cost"], answer: 1,
    explanation: "Early probable cost is decision support, not a final guarantee; its basis and uncertainty must be visible to the client.",
  },
  221: {
    topic: "Ambient light and displays",
    prompt: "A proposed display will face uncontrolled daylight from a window. What should the designer do before relying on a higher-brightness product?",
    choices: ["Measure representative conditions and evaluate light control, display placement, screen characteristics, contrast, and required content visibility", "Specify the brightest catalog value without measuring", "Assume daylight never affects perceived contrast", "Reduce the source resolution"], answer: 0,
    explanation: "Ambient light is a system and room condition; measurement and coordinated light, placement, surface, and display decisions are more reliable than a brightness-only response.",
  },
  222: {
    topic: "Digital video path compatibility",
    prompt: "A source, matrix switcher, extender, and display all have digital video connectors. What must still be verified end to end?",
    choices: ["Required format, resolution, frame rate, color, bandwidth, content protection, EDID behavior, and supported distance", "That every connector shell is the same color", "Only the display's native resolution", "That the source cable is the shortest item in the rack"], answer: 0,
    explanation: "A shared connector does not guarantee an interoperable path; every link and active device must support the required signal and negotiation features.",
  },
  228: {
    topic: "Rear-projection planning",
    prompt: "Which condition should be confirmed before choosing rear projection for a room?",
    choices: ["Adequate protected space and service access behind the screen, compatible geometry, light control, and required image performance", "Only that the projector can be ceiling mounted", "That viewers can enter the projection cavity", "That no maintenance access will ever be needed"], answer: 0,
    explanation: "Rear projection trades audience-side equipment for dedicated space behind the image plane and must satisfy geometry, access, environmental, and performance needs.",
  },
  229: {
    topic: "Display design criteria",
    prompt: "Users must compare fine spreadsheet data from the rear half of a bright room. Which design sequence is strongest?",
    choices: ["Define the content-detail task and viewing positions, assess the environment, then size and select the display to meet those requirements", "Choose a familiar brand, then adjust the room later", "Start with the available wall width only", "Maximize diagonal size without checking visual acuity or sightlines"], answer: 0,
    explanation: "The viewing task, content detail, audience location, and environment establish the performance criteria that drive display size and technology.",
  },
  230: {
    topic: "Audio frequency-response requirements",
    prompt: "One room supports speech reinforcement only; another must reproduce full-range music. How should their frequency-response requirements be set?",
    choices: ["Derive each requirement from its program material, audience expectation, room, and system purpose", "Use the same widest possible response for every project", "Base both on microphone connector type", "Specify speech bandwidth for the music room"], answer: 0,
    explanation: "Required response follows the application: speech intelligibility and high-quality music reproduction place different demands on the system.",
  },
  237: {
    topic: "IPv6 endpoint integration",
    prompt: "A new AV endpoint has only a link-local IPv6 address, but it must be managed from another routed network. What is the appropriate next step?",
    choices: ["Coordinate the approved routable IPv6 addressing, prefix, gateway or routing, and security policy with the network authority", "Invent a public prefix", "Use the link-local address through every router", "Disable all network security controls"], answer: 0,
    explanation: "Link-local IPv6 supports communication on the local link but is not routed; managed cross-network access requires approved addressing and network policy.",
  },
  242: {
    topic: "AC circuit loading",
    prompt: "Several rack devices will share a branch circuit. What should the integrator verify before connecting the completed load?",
    choices: ["Equipment input requirements, calculated load, circuit rating, other connected loads, receptacle and protection suitability, and applicable rules", "Only that every plug physically fits", "The rack's network address", "The loudspeaker coverage angle"], answer: 0,
    explanation: "Safe integration requires the complete electrical load and distribution conditions to remain within ratings and applicable requirements.",
  },
  243: {
    topic: "Circuit identification",
    prompt: "Rack receptacles are labeled for a dedicated circuit, but the panel schedule appears outdated. What should the integration team do?",
    choices: ["Have the circuit identity and condition safely verified by the authorized electrical party before relying on it", "Assume the receptacle label is current", "Open and rewire the panel without authorization", "Power the rack from multiple unknown extension cords"], answer: 0,
    explanation: "Conflicting electrical documentation is a safety and coordination issue; the authorized party should verify the actual circuit before equipment is placed in service.",
  },
  244: {
    topic: "Wireless antenna placement",
    prompt: "A rack-mounted wireless receiver performs poorly after its antennas are left behind a metal equipment door. What is the best correction?",
    choices: ["Use the approved antenna arrangement and cable system to provide suitable placement, orientation, line of sight, and separation", "Increase audio gain", "Place both antennas against the rack power supply", "Disable receiver diversity"], answer: 0,
    explanation: "Metal obstructions and poor antenna geometry can degrade the RF path; antenna placement and distribution should follow the system design and manufacturer guidance.",
  },
  246: {
    topic: "Cost forecasting",
    prompt: "Committed purchase orders are on budget, but labor is consuming hours faster than planned. What should the project lead review?",
    choices: ["Actual and remaining labor against the cost baseline, then forecast the effect on total project cost", "Equipment cost only", "The original budget without current actuals", "Future invoices after the project closes"], answer: 0,
    explanation: "Budget control compares the approved baseline with actual commitments and progress, then forecasts the cost to complete rather than waiting for final invoices.",
  },
  250: {
    topic: "Change-impact analysis",
    prompt: "A requested finish change does not alter equipment quantity but delays rack access by two weeks. What belongs in the change review?",
    choices: ["The schedule, labor, sequencing, risk, and cost effects as well as the visible scope change", "Equipment quantity only", "No review because the device list is unchanged", "Only the client's preferred completion date"], answer: 0,
    explanation: "A change can affect schedule, labor, dependencies, risk, and cost even when the bill of materials is unchanged.",
  },
  249: {
    topic: "Predecessor-trade delay",
    prompt: "The millwork required before AV rack installation will be late. What should the AV project lead do?",
    choices: ["Document the dependency and impact, coordinate a revised sequence with the responsible parties, and update the forecast", "Install the rack in an unapproved location", "Report the delay only after closeout", "Remove the rack from the project without authorization"], answer: 0,
    explanation: "A predecessor delay should be documented and coordinated through the project schedule so the team can manage access, sequencing, cost, and downstream milestones.",
  },
  251: {
    topic: "Schedule dependencies",
    prompt: "Display backing must be inspected before walls close, and displays cannot be mounted until finishes cure. What should the project lead do?",
    choices: ["Record both dependencies and coordinate their dates with the responsible trades", "Schedule all AV work for the final day", "Ignore non-AV milestones", "Mount displays before backing inspection"], answer: 0,
    explanation: "Dependencies connect AV activities to predecessor work and must be visible in the coordinated schedule before they create rework or delay.",
  },
  252: {
    topic: "Formal clarification",
    prompt: "The reflected ceiling plan conflicts with the AV mounting detail. Which document should request formal clarification before work proceeds?",
    choices: ["Request for information (RFI)", "Purchase order", "Preventive-maintenance log", "Training attendance sheet"], answer: 0,
    explanation: "An RFI records the conflict and requests an authoritative clarification without allowing the field team to invent a design decision.",
  },
  253: {
    topic: "Submittal approval",
    prompt: "A proposed substitute may affect mounting, power, and control. What should occur before it is purchased and installed?",
    choices: ["Submit the required technical information and obtain approval through the project's submittal process", "Order it first and seek approval at closeout", "Ask the delivery driver to confirm compatibility", "Install it temporarily without documentation"], answer: 0,
    explanation: "The submittal process allows the authorized design and project parties to review compliance and coordination impacts before commitment.",
  },
  254: {
    topic: "Trade coordination",
    prompt: "A ceiling loudspeaker location conflicts with a sprinkler head and light fixture. What is the best project-management response?",
    choices: ["Coordinate a compliant location with the affected trades and document the approved resolution", "Move the sprinkler without notifying anyone", "Delete the loudspeaker from the scope", "Let the first installer on site choose"], answer: 0,
    explanation: "Cross-trade conflicts require coordinated, documented resolution that preserves system performance and applicable building requirements.",
  },
  255: {
    topic: "Change authorization",
    prompt: "A client requests an added room after contract award. What should happen before the added work begins?",
    choices: ["Document the scope, cost, schedule impact, and obtain authorization through the change-control process", "Begin work based on an informal hallway request", "Hide the cost in another line item", "Wait until final invoicing to mention it"], answer: 0,
    explanation: "Controlled change protects both parties by defining the requested work and obtaining authorized agreement on its consequences before execution.",
  },
  256: {
    topic: "As-built updates",
    prompt: "An approved field change reroutes signal cable and relocates a device. What documentation action is required?",
    choices: ["Capture the change promptly so the final as-built record matches the installation", "Leave the original drawing unchanged", "Record it only in a technician's private notebook", "Update the sales brochure instead"], answer: 0,
    explanation: "Field changes must flow into controlled redlines and final as-built documentation so future operation and service reflect the real system.",
  },
  257: {
    topic: "Long-lead procurement",
    prompt: "A critical processor has a lead time longer than the remaining installation schedule. What should the project lead do first?",
    choices: ["Confirm the requirement and approved item, assess schedule impact, and coordinate procurement or an approved alternative", "Assume it will arrive early", "Buy an unreviewed substitute", "Remove commissioning from the schedule"], answer: 0,
    explanation: "Long-lead risk should be surfaced early, tied to the approved requirement, and managed through procurement, schedule, and formal substitution controls.",
  },
  258: {
    topic: "Pre-concealment quality control",
    prompt: "Cable pathways will be hidden when the ceiling closes tomorrow. Which action provides the most value today?",
    choices: ["Inspect, test as appropriate, photograph, and resolve deficiencies before concealment", "Wait for final acceptance testing", "Close the ceiling to protect the schedule", "Document only the visible rack equipment"], answer: 0,
    explanation: "Work that will become inaccessible should be checked and documented while correction is still practical.",
  },
  259: {
    topic: "Project closeout package",
    prompt: "Which closeout package best supports the client's transition to operations?",
    choices: ["Approved as-builts, configuration backups, test results, manuals, warranties, training records, and open-item status", "The original quotation only", "A list of product marketing pages", "Unlabeled spare parts without records"], answer: 0,
    explanation: "Closeout transfers the verified system and the information needed to operate, maintain, restore, and support it.",
  },
  260: {
    topic: "Progress control",
    prompt: "A weekly review shows several AV activities slipping behind their planned dates. What should the project lead do?",
    choices: ["Update actual progress, analyze affected dependencies and milestones, assign recovery actions, and communicate the forecast", "Leave the schedule unchanged to avoid concern", "Add staff without checking the cause", "Report only completed tasks"], answer: 0,
    explanation: "Useful progress control compares plan with actuals, identifies downstream effects, assigns corrective action, and keeps stakeholders informed.",
  },
  262: {
    topic: "Wireless microphone coordination",
    prompt: "Several wireless microphones work alone but suffer dropouts and interference when used together. What should support staff check first?",
    choices: ["Frequency coordination, compatible channel spacing, local RF conditions, antenna system, and transmitter setup", "The room-lighting color temperature", "The wired loudspeaker impedance only", "Whether all microphones use the same display name"], answer: 0,
    explanation: "Multi-channel wireless operation requires coordinated frequencies and a sound RF path; individually clear channels can interact or encounter local interference when combined.",
  },
  265: {
    topic: "Using commissioning records",
    prompt: "Users report that a room no longer reaches its accepted audio level. Which record provides the best performance baseline for support?",
    choices: ["The documented acceptance or commissioning test result with its conditions and criteria", "The product brochure", "A photo of the unopened equipment cartons", "The original meeting invitation"], answer: 0,
    explanation: "Verified acceptance data provides a measured reference for determining whether performance has changed and for narrowing the affected part of the system.",
  },
  263: {
    topic: "Clipped computer image",
    prompt: "A laptop image is visible but its desktop edges are cut off on the room display. Which checks should support staff make first?",
    choices: ["Source output format and scaling, display aspect or overscan settings, and the signal path's negotiated resolution", "Wireless microphone frequency coordination", "Loudspeaker polarity", "Rack ventilation direction"], answer: 0,
    explanation: "A cropped image commonly results from source scaling, aspect or overscan processing, or format negotiation rather than an audio or environmental fault.",
  },
  271: {
    topic: "Congested wireless network",
    prompt: "A control tablet is responsive near the access point but unreliable in the occupied room. What should support staff coordinate with the network team?",
    choices: ["Coverage and signal measurements, channel utilization and interference, roaming behavior, capacity, and approved configuration", "A higher projector lamp setting", "An analog audio ground lift", "Changing every endpoint to the same IP address"], answer: 0,
    explanation: "Reliable Wi-Fi depends on RF coverage, interference, channel use, capacity, roaming, and network policy, all of which should be measured and coordinated.",
  },
  278: {
    topic: "Training verification",
    prompt: "After end-user training, which evidence best shows the training met its objective?",
    choices: ["Representative users can complete the required operating tasks using the delivered system and documentation", "Every attendee signed in", "The trainer covered every slide", "The session lasted its scheduled duration"], answer: 0,
    explanation: "Training is successful when intended users can perform the required tasks safely and correctly; attendance and presentation coverage alone do not prove competence.",
  },
  279: {
    topic: "Equipment custody",
    prompt: "Rented equipment is released from the warehouse to an event crew. Which control best protects custody?",
    choices: ["Record the asset identifiers, condition, authorized recipient, time, destination, and return responsibility", "Rely on memory because the crew is familiar", "Track only the shipping case count", "Remove serial-number labels before release"], answer: 0,
    explanation: "A documented chain of custody links identifiable assets to an authorized recipient, condition, destination, and return obligation.",
  },
  281: {
    topic: "Preventive-maintenance planning",
    prompt: "What is the best basis for an AV preventive-maintenance schedule?",
    choices: ["Manufacturer guidance, operating environment, usage, criticality, service history, and contractual requirements", "The same monthly interval for every device", "Only the equipment purchase date", "Maintenance only after users report failure"], answer: 0,
    explanation: "A defensible maintenance interval reflects equipment guidance and the actual conditions, duty, risk, history, and service commitment.",
  },
  282: {
    topic: "Maintenance records",
    prompt: "Which entry makes a maintenance log most useful for the next technician?",
    choices: ["Date, technician, asset, symptom or planned task, work performed, changes, test result, and follow-up", "Checked system", "A copy of the room calendar", "The technician's initials only"], answer: 0,
    explanation: "A complete record explains the condition, action, result, and remaining work so trends and future decisions are evidence based.",
  },
  283: {
    topic: "Blocked equipment ventilation",
    prompt: "A rack device is running hotter than normal and its intake is clogged with dust. What should the technician do?",
    choices: ["Follow safe shutdown and maintenance procedures, clear the approved airflow path, inspect filters, and verify temperatures and operation", "Increase the rack thermostat limit", "Cover the temperature alarm", "Spray cleaner into the powered device"], answer: 0,
    explanation: "Restricted airflow should be corrected safely according to equipment and site procedures, followed by verification that cooling and operation have recovered.",
  },
  284: {
    topic: "Firmware maintenance",
    prompt: "Before updating firmware on a critical AV processor, what preparation is most important?",
    choices: ["Verify compatibility and release guidance, save the configuration, plan rollback and downtime, then obtain required approval", "Update during a live event", "Erase the current configuration first", "Assume every newer version is compatible"], answer: 0,
    explanation: "Firmware work can alter compatibility and configuration, so a verified version, recoverable backup, approved window, and rollback plan reduce operational risk.",
  },
  285: {
    topic: "Replacement-component compatibility",
    prompt: "A failed networked AV endpoint is being replaced. What must be checked beyond physical fit?",
    choices: ["Electrical and signal compatibility, firmware, licenses, addressing, configuration, control integration, and required performance", "Only the enclosure color", "Only whether the connector can be forced into place", "The replacement's retail price"], answer: 0,
    explanation: "A replacement must function within the complete system, including power, signal, software, network, control, configuration, and performance dependencies.",
  },
  286: {
    topic: "Intermittent-fault maintenance",
    prompt: "An AV fault occurs briefly several times a week but is absent during the service visit. What is the best next step?",
    choices: ["Collect timestamps, logs, environmental and user context, reproduce conditions where safe, and correlate the evidence before replacing parts", "Replace every device in the signal path", "Close the ticket because the symptom is absent", "Disable monitoring to reduce alerts"], answer: 0,
    explanation: "Intermittent faults require time-correlated evidence and controlled reproduction; indiscriminate replacement can hide the cause and create new variables.",
  },
  287: {
    topic: "Post-maintenance verification",
    prompt: "After replacing a failed signal processor, when is the maintenance activity complete?",
    choices: ["After restoring the approved configuration, testing the affected path and dependent user functions, and documenting the result", "As soon as the new unit powers on", "When the old unit is removed from the rack", "After the invoice is prepared"], answer: 0,
    explanation: "Completion requires restoration and end-to-end verification of the affected service, followed by a record of what changed and how operation was confirmed.",
  },
  290: {
    topic: "Confirming an intermittent symptom",
    prompt: "A user reports that remote participants occasionally cannot hear the room, but the system is working when the technician arrives. What should the technician do first?",
    choices: ["Clarify when and how the symptom occurs, review available logs, and reproduce the reported workflow before changing components", "Replace the conferencing codec immediately", "Increase every audio gain setting", "Close the ticket because the fault is not currently visible"], answer: 0,
    explanation: "A precise, reproducible symptom and time-correlated evidence define what is actually failing and prevent unrelated changes from obscuring an intermittent cause.",
  },
  293: {
    topic: "Bit-depth tradeoffs",
    prompt: "For an uncompressed digital sample, what is the direct effect of increasing bit depth while sample rate and channel count remain unchanged?",
    choices: ["More quantization levels and a higher data rate", "Fewer quantization levels and a lower data rate", "A lower sample rate", "Automatic lossy compression"], answer: 0,
    explanation: "Each additional bit increases the number of representable amplitude levels and adds data per sample; it does not itself change sample rate or apply compression.",
  },
};

const nonChoiceIds = new Set([28, 49, 90, 105, 129, 135, 146, 154, 159, 162, 171, 178, 183, 192, 193]);
const multiChoiceIds = new Set([88, 164]);
const balancedKeyPositions = new Map<number, number>(
  Array.from({ length: 300 }, (_, index) => index + 1)
    .filter((id) => !nonChoiceIds.has(id) && !multiChoiceIds.has(id))
    .map((id, index) => [id, index % 4] as const),
);

const canonicalTasks: Record<string, string> = {
  "Integrate AV solutions": "Integrate AV solution",
  "Integrate AV Solution": "Integrate AV solution",
};

const taskOverrides: Record<number, string> = {
  24: "Conduct a site survey",
  31: "Conduct a customer needs analysis",
  34: "Conduct a customer needs analysis",
  50: "Conduct maintenance activities",
  51: "Conduct maintenance activities",
  52: "Conduct maintenance activities",
  60: "Conduct maintenance activities",
  61: "Conduct maintenance activities",
  77: "Manage AV integration",
  78: "Manage AV integration",
  79: "Manage AV integration",
  82: "Manage AV integration",
  83: "Manage AV integration",
  84: "Manage AV integration",
  85: "Manage AV integration",
  86: "Manage AV integration",
  114: "Develop an AV project scope",
  115: "Conduct a customer needs analysis",
  116: "Develop an AV project scope",
  117: "Develop an AV project scope",
  118: "Develop an AV project scope",
  119: "Conduct a customer needs analysis",
  120: "Develop an AV project scope",
  121: "Develop an AV project scope",
  122: "Develop an AV project scope",
  123: "Develop an AV project scope",
  124: "Develop an AV project scope",
  125: "Develop an AV project scope",
  126: "Develop an AV project scope",
  127: "Develop an AV project scope",
  144: "Manage AV integration",
  145: "Manage AV integration",
  146: "Manage AV integration",
  147: "Manage AV integration",
  148: "Manage AV integration",
  149: "Manage AV integration",
  150: "Manage AV integration",
  151: "Manage AV integration",
  152: "Manage AV integration",
  153: "Manage AV integration",
  154: "Manage AV integration",
  155: "Manage AV integration",
  156: "Manage AV integration",
  157: "Manage AV integration",
  158: "Manage AV integration",
  159: "Manage AV integration",
  177: "Conduct maintenance activities",
  178: "Conduct maintenance activities",
};

const termLessons: Record<string, string> = {
  "analog": "describes a continuously variable signal, not discrete high/low states",
  "digital": "describes discrete encoded states and regeneration, not a continuously varying waveform",
  "binary": "uses two discrete states, so it is digital rather than continuously variable",
  "quantized": "means values have been mapped to discrete levels, a digital-sampling concept",
  "packetized digital": "organizes digital data into packets; it remains discrete rather than continuously variable",
  "unbalanced analog": "uses a signal conductor and reference/shield and cannot regenerate discrete high/low states",
  "balanced analog": "uses equal-impedance conductors for common-mode rejection, but remains analog and is not state-regenerated",
  "baseband analog video": "carries a continuously varying video waveform without digital state regeneration",
  "codec": "encodes and decodes data; it is not merely a container or file format",
  "propagation": "is the travel of sound through a medium",
  "compression": "is molecular crowding in a sound wave or data reduction, depending on context",
  "generation": "is creation of a signal, not its movement through air",
  "echo": "is a distinct delayed reflection; many persistent reflections combine as reverberation",
  "reverberation": "is the persistence of many reflections after the source changes or stops",
  "microphone": "converts acoustic energy to an electrical signal; it is an input transducer",
  "processor": "modifies or routes a signal but does not normally convert the final electrical signal into sound",
  "equalizer": "adjusts frequency response and normally precedes the power-amplifier/loudspeaker output stage",
  "microphone preamplifier": "raises mic level near the input of the signal chain",
  "signal processor": "performs routing, mixing, equalization, delay, or other processing before the power-output stage",
  "attenuation": "is a reduction in level, whereas gain adjustment can raise or lower a stage",
  "unity gain": "means output level equals input level, so it is a specific gain setting rather than any level change",
  "lumens": "measure total luminous flux from a source, not incident illuminance at a surface",
  "lux": "measures incident illuminance in lumens per square metre",
  "nits": "measure luminance from a visible surface, not incident illumination",
  "kelvins": "describe correlated colour temperature, not light quantity",
  "contrast ratio": "compares bright and dark image levels; it does not define a display's pixel grid",
  "aspect ratio": "is the proportional relationship of image width to height, not its pixel count",
  "bus": "uses a shared linear backbone or path",
  "star": "connects endpoints to a central device",
  "mesh": "provides multiple interconnections or paths among nodes",
  "ring": "connects each node to two neighbours in a closed loop",
  "switch": "forwards local Ethernet frames; it is not inherently the device that routes between IP networks",
  "router": "forwards packets between IP networks and normally provides the path to outside networks",
  "gateway": "is an entry/translation point between systems or networks, but is not the generic answer for every routing or security function",
  "firewall": "permits or blocks traffic according to security rules",
  "mac address": "identifies a network interface for local data-link delivery",
  "ipv4 address": "is a 32-bit network-layer address used for IP delivery and routing",
  "subnet mask": "separates the network prefix from the host portion of an IPv4 address",
  "dns host name": "is a human-readable name resolved to an IP address",
  "dns display name": "is a human-readable label; network-layer delivery still uses IP addresses",
  "ethernet switch-port label": "is an administrative identifier for a physical port, not a network-layer destination",
  "manufacturer portion of a mac address": "identifies a vendor allocation and does not replace an IP address for routed delivery",
  "noise": "is unwanted energy that degrades or interferes with the wanted signal",
  "shielding": "limits electromagnetic interference from coupling into or out of a cable",
  "bidirectional": "permits communication in both directions, including a return response",
  "unidirectional": "carries communication in one direction only",
  "volts": "measure electrical potential difference, not current, resistance, or power",
  "amperes": "measure electric current",
  "ohms": "measure resistance or impedance, not current or power",
  "watts": "measure power, not voltage, current, or impedance",
  "resistance": "opposes DC current; impedance is the broader AC opposition including reactance",
  "impedance": "is opposition to AC current and includes resistance and reactance",
  "source": "is the point to which circuit current must ultimately return",
  "ground": "is a safety/reference connection and is not the normal destination of load current",
  "vhf": "covers 30 to 300 MHz, below the UHF band",
  "uhf": "covers 300 MHz to 3 GHz",
  "hf": "covers 3 to 30 MHz",
  "vlf": "covers 3 to 30 kHz",
  "modulation": "places information onto a carrier for transmission",
  "demodulation": "recovers information from a received carrier",
  "aff": "means above finished floor",
  "nts": "means not to scale",
  "rcp": "means reflected ceiling plan",
  "nic": "means not in contract",
  "reflected ceiling plan": "shows ceiling features as though reflected in a mirror and is used for ceiling-device coordination",
  "mechanical drawing": "shows systems such as HVAC ductwork and mechanical piping",
  "elevation drawing": "shows a vertical face of a wall or object",
  "section drawing": "shows the internal relationship revealed by an imaginary cut through the building or assembly",
  "detail drawing": "enlarges a specific construction or installation condition",
  "as-built drawings": "record the system as actually installed, including approved field changes",
  "rfi": "requests formal clarification of incomplete, conflicting, or unclear project information",
  "change order (co)": "records an authorized contractual change to scope, price, or schedule",
  "wbs": "decomposes project deliverables into related elements of work",
  "gantt chart": "shows tasks, durations, dependencies, and milestones across time",
  "xlr": "is commonly used for professional balanced audio, not 75-ohm SDI coax or Ethernet",
  "3-pin xlr": "is the normal professional balanced analog microphone connector",
  "rca": "is commonly used for consumer unbalanced audio or composite video",
  "bnc": "is a bayonet-lock coax connector commonly used for professional 75-ohm SDI",
  "75-ohm bnc": "is used for coaxial video/RF paths, not a standard balanced microphone input",
  "8p8c": "is the modular connector format commonly associated with twisted-pair Ethernet",
  "8p8c modular connector": "is associated with twisted-pair data/control cabling, not standard balanced microphone cable",
  "structural engineer": "evaluates structure, loads, anchorage, and difficult mounting conditions within the engineer's authority",
  "echo canceler": "removes the far-end echo path in conferencing to preserve speech intelligibility",
  "compressor": "controls dynamic range; it does not remove the acoustic echo path in a conference system",
  "crossover": "divides audio into frequency bands for appropriate loudspeaker drivers",
  "insufficient compression": "affects dynamic-range control; it is not the usual cause of constant broadband hiss",
  "noise gate thresholds set too low": "can leave low-level noise audible, but do not create the poor signal-to-noise ratio caused by upstream gain staging",
  "source output gain set too high": "is more likely to overload the next input and cause clipping than to require later stages to amplify their noise floor",
};

function cleanText(value: string) {
  return value
    .replace(/^Applied scenario \d+:\s*/i, "")
    .replace(/\b(?:a\(n\)\s+|a\s+|the\s+)?the missing term or value\b/gi, "[…]")
    .replace(/\bW\s+hat\b/gi, "What")
    .replace(/\bWhich option cost descriptions provides\b/gi, "Which cost description provides")
    .replace(/\bWhich option types of maintenance agreements commits\b/gi, "Which type of maintenance agreement commits")
    .replace(/\bWhich option documents would an AV company submit\b/gi, "Which document should an AV company submit")
    .replace(/\bWhich approach should the AV company respond\b/gi, "How should the AV company respond")
    .replace(/\bWhich approach should an AV system designer determine\b/gi, "How should an AV system designer determine")
    .replace(/\bWhich approach should the AV design ensure\b/gi, "How should the AV design ensure")
    .replace(/\bT\s+([a-z])/g, "T$1")
    .replace(/\bW\s+([a-z])/g, "W$1")
    .replace(/\s*PART\s+[IVX]+PART\s+[IVX]+/g, "")
    .replace(/\s+\d{2}-ch\d+\.indd.*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function balanceChoices(question: BaseQuestion) {
  if (!question.choices || typeof question.answer !== "number" || multiChoiceIds.has(question.id)) return question;
  const target = balancedKeyPositions.get(question.id);
  if (target === undefined || target === question.answer) return question;
  const correct = question.choices[question.answer];
  const distractors = question.choices.filter((_, index) => index !== question.answer);
  const choices = [...distractors];
  choices.splice(target, 0, correct);
  return { ...question, choices, answer: target };
}

function polishPrompt(question: BaseQuestion) {
  const prompt = cleanText(question.prompt);
  const topic = question.topic.toLowerCase().replace(/\s*-\s*applied scenario$/i, "");
  if (/_{3,}|\[…\]/.test(prompt)) {
    return `Which option most accurately completes this statement about ${topic}? “${prompt.replace(/_{3,}/g, "[…]")}”`;
  }
  const recall = /^(what|which|how|why|at what|typically)\b/i.test(prompt);
  const alreadyContextual = /\b(client|technician|designer|installer|project|system|site|room|event|user)\b/i.test(prompt.slice(0, 100));
  if (recall && !alreadyContextual) return `A CTS is reviewing ${topic} for an AV solution. ${prompt}`;
  return prompt;
}

function normalized(value: string) {
  return value.toLowerCase().replace(/[“”‘’'".,;:!?()[\]]/g, "").replace(/\s+/g, " ").trim();
}

function decisionCue(question: BaseQuestion) {
  const text = `${question.topic} ${question.prompt}`.toLowerCase();
  if (/analog|digital|bit depth|codec|compression|sample/.test(text)) return "distinguish continuously variable waveforms from discrete encoded states, and separate sampling, bit depth, bit rate, and compression";
  if (/signal management|cable|wire|shield|matrix switcher/.test(text)) return "identify the signal type, path, interference control, routing function, and published cable limits before choosing or testing the link";
  if (/network|\bip\b|ethernet|vlan|wi-fi|switch|router|firewall/.test(text)) return "identify the layer and function being tested, then coordinate addressing and policy with the client's network authority";
  if (/audio|sound|microphone|loudspeaker|spl|impedance|gain/.test(text)) return "follow the signal flow and keep acoustic, electrical, and level concepts distinct";
  if (/video|display|image|project|light|resolution|throw/.test(text)) return "start with the viewing task and environment, then verify the complete signal path, image geometry, light, and device limits";
  if (/control|relay|ir|interface|program|macro/.test(text)) return "distinguish one device function from a programmed sequence and verify both command and feedback paths";
  if (/voltage|current|power|ground|circuit|electrical/.test(text)) return "keep quantity, unit, conductor role, and protective function separate; safety rules override convenience";
  if (/wireless|rf|antenna|frequency|receiver|transmitter/.test(text)) return "separate carrier frequency, modulation, antenna behavior, and receiver diversity, then coordinate frequencies before use";
  if (question.task === "Conduct a customer needs analysis") return "start with the user's communication objective, workflow, constraints, and confirmed requirements before selecting products";
  if (question.task === "Conduct a site survey") return "observe, measure, photograph, and reconcile field conditions against the available drawings and site requirements";
  if (question.task === "Develop an AV project scope") return "turn confirmed needs and site findings into explicit outcomes, boundaries, assumptions, exclusions, cost, and approval";
  if (question.task === "Design AV solutions") return "translate requirements into an end-to-end design whose calculations, interfaces, performance, and documentation can be verified";
  if (question.task === "Integrate AV solution") return "follow approved documentation and ratings, protect the installation, then terminate, configure, inspect, and test systematically";
  if (question.task === "Manage AV integration") return "coordinate people, trades, schedule, safety, controlled documents, training, and closeout rather than treating installation as isolated device work";
  if (question.task === "Provide AV support") return "confirm the user's objective and symptom, restore operation safely, verify with the user, and communicate the resolution clearly";
  if (question.task === "Supervise AV operations") return "balance people, inventory, vendors, security, schedule, budget, and customer obligations using documented processes";
  if (question.task === "Conduct maintenance activities") return "follow the maintenance plan, protect people and equipment, verify performance, and leave a useful service record";
  if (question.task === "Troubleshoot and repair AV solutions") return "confirm the symptom, check simple causes, divide the signal path, change one variable, then verify and document the result";
  return "identify the exact function or procedure named in the stem and reject related terms that do a different job";
}

function optionSubject(choice: string) {
  if (choice.length <= 72) return `“${choice}”`;
  const conciseStart = choice.slice(0, 44).replace(/\s+\S*$/, "");
  const conciseEnd = choice.slice(-22).replace(/^\S*\s+/, "");
  return `The choice “${conciseStart}…${conciseEnd}”`;
}

function wrongChoiceLesson(question: BaseQuestion, choice: string, correct: string, why: string) {
  const subject = optionSubject(choice);
  const lesson = termLessons[normalized(choice)];
  const negativeStem = /\b(not|except|least)\b/i.test(question.prompt);
  const numericOrFormula = /^[-+±]?\d|\d\s*(dB|mm|cm|m|ft|in|ohm|percent|%)|=|×|\//i.test(choice);
  const unsafeAbsolute = /\b(always|never|only|any|immediately|without|skip|assume|regardless|every)\b/i.test(choice);
  const explanationMarksOthersValid = /other (observations|options|choices).*(acceptable|valid)|remaining (observations|options|choices).*(acceptable|valid)/i.test(why);
  let contrast: string;
  if (lesson) {
    contrast = `${subject} ${lesson}`;
  } else if (explanationMarksOthersValid) {
    contrast = `${subject} describes an acceptable condition, so it is not the defect requested by the stem`;
  } else if (negativeStem) {
    contrast = `${subject} is a valid or plausible practice in this context, so it does not satisfy the stem's requested exception`;
  } else if (numericOrFormula) {
    contrast = `${subject} uses the wrong value, unit, or relationship for the stated quantities`;
  } else if (unsafeAbsolute) {
    contrast = `${subject} relies on an absolute or shortcut that skips required verification, coordination, safety, or documentation`;
  } else if (choice.length > 72) {
    contrast = `${subject} addresses a related concern but omits or misorders the decisive requirement in this situation`;
  } else {
    contrast = `${subject} names a related term or action, but its function does not match the specific definition or decision requested here`;
  }
  return `Not this one: ${contrast}. Decisive rule: ${why}. Best answer: ${correct}.`;
}

function studyNote(question: BaseQuestion) {
  const why = cleanText(question.explanation).replace(/[.;]+$/, "");
  return `${why}. CTS cue: ${decisionCue(question)}.`;
}

function buildRationales(question: BaseQuestion) {
  if (!question.choices?.length) return undefined;
  const answerIndexes = question.type === "multi"
    ? ((question.answer as number[]) ?? [])
    : [Number(question.answer)];
  const correct = answerIndexes.map((index) => question.choices?.[index]).filter(Boolean).join("; ").replace(/[.;]+$/, "");
  const why = cleanText(question.explanation).replace(/[.;]+$/, "");
  return question.choices.map((choice, index) => {
    if (answerIndexes.includes(index)) {
      return `Correct: ${why}. CTS cue: ${decisionCue(question)}.`;
    }
    return wrongChoiceLesson(question, choice, correct, why);
  });
}

function enrichQuestion(question: BaseQuestion) {
  const task = taskOverrides[question.id] ?? canonicalTasks[question.task] ?? question.task;
  const enriched = { ...question, task };
  const note = studyNote(enriched);
  return {
    ...enriched,
    studyNote: note,
    interactionRationale: enriched.choices?.length ? undefined : `Work from the governing relationship or dependency, not from memory alone. ${note}`,
    rationales: buildRationales(enriched),
  };
}

const base = (parsed as BaseQuestion[]).map((question) => {
  let changed = { ...question, ...(replacements[question.id] ?? {}), ...(auditedOverrides[question.id] ?? {}) } as BaseQuestion;
  changed = {
    ...changed,
    topic: changed.topic.replace(/\s*-\s*applied scenario$/i, ""),
    prompt: polishPrompt(changed),
    explanation: cleanText(changed.explanation),
    choices: changed.choices?.map(cleanText),
  };
  changed = balanceChoices(changed);
  if (nonChoiceIds.has(question.id)) {
    return enrichQuestion({ ...changed, choices: undefined, answer: undefined, rationales: undefined });
  }
  if (HOTSPOT_IDS.has(question.id) && changed.choices && typeof changed.answer === "number") {
    const transformed = {
      ...changed,
      type: "hotspot" as const,
      prompt: `${changed.prompt} Select the correct labeled region in the diagram.`,
      hotspots: changed.choices.map((label, index) => ({ id: String(index), label, ...hotspotPositions[index] })),
      answer: String(changed.answer),
    };
    return enrichQuestion(transformed);
  }
  if (CONNECT_IDS.has(question.id) && changed.choices && typeof changed.answer === "number") {
    const transformed = {
      ...changed,
      type: "connect" as const,
      prompt: `${changed.prompt} Draw the connection from the prompt node to the best destination.`,
      answer: String(changed.answer),
    };
    return enrichQuestion(transformed);
  }
  return enrichQuestion(changed);
});

const serviceQuestions: BaseQuestion[] = [
  {
    id: 296, type: "single", domain: "D", task: "Troubleshoot and repair AV solutions", topic: "HDMI video dropouts",
    prompt: "One room has intermittent HDMI dropouts from every source, while an identical nearby room is stable. After reproducing the symptom, what is the best first isolation step?",
    choices: ["Replace the display before testing the path", "Inspect and reseat the path, then substitute a known-good cable or link segment", "Force every source to a lower resolution and close the ticket", "Reload the control program because it selects the inputs"], answer: 1,
    explanation: "Start with the simplest likely path fault: verify connectors and substitute a known-good cable before replacing major components.", source: sourceFor(22, "465-483"), chapter: 22,
  },
  {
    id: 297, type: "single", domain: "D", task: "Troubleshoot and repair AV solutions", topic: "Audio distortion",
    prompt: "Every loudspeaker in a room sounds clean at low level, but all channels distort as normal operating level is approached. What should the technician examine first?",
    choices: ["Gain structure and clipping indicators at each stage", "Loudspeaker aiming and coverage overlap", "Room reverberation time only", "The control-network subnet mask"], answer: 0,
    explanation: "Distortion that appears as level rises commonly points to clipping or improper gain structure, so signal levels should be checked stage by stage.", source: sourceFor(22, "474-483"), chapter: 22,
  },
  {
    id: 298, type: "single", domain: "D", task: "Troubleshoot and repair AV solutions", topic: "Frozen control interface",
    prompt: "A touch-control screen is frozen while the AV devices still operate from their local controls. Which action best isolates the fault?",
    choices: ["Replace the controlled devices as a group", "Verify the touch interface’s power and communication, then test or restart it using the approved procedure", "Reload firmware on every endpoint before testing the panel", "Replace the network switch without checking link status"], answer: 1,
    explanation: "Because the controlled devices still work locally, isolate the user-interface/control path before changing unrelated equipment.", source: sourceFor(22, "465-483"), chapter: 22,
  },
  {
    id: 299, type: "single", domain: "D", task: "Supervise AV operations", topic: "Conference-room water leak",
    prompt: "Water is found leaking above an energized conference-room rack. What is the first priority?",
    choices: ["Cover the energized rack and continue operating", "Keep people clear, safely isolate the electrical hazard through authorized procedures, and notify facilities or emergency personnel", "Open the rack and begin drying components while power remains on", "Start a component inventory before addressing the energized hazard"], answer: 1,
    explanation: "Life safety comes first. Do not work on wet energized equipment; isolate the hazard using authorized procedures and coordinate with facilities/emergency personnel.", source: sourceFor(20, "445-454"), chapter: 20,
  },
  {
    id: 300, type: "single", domain: "D", task: "Conduct maintenance activities", topic: "Projector deviation",
    prompt: "A ceiling-mounted projector has slowly shifted out of alignment. Which maintenance response is most complete?",
    choices: ["Apply additional digital keystone correction without inspecting the mount", "Verify structural and mount security, check for vibration, realign, test the image, and document the work", "Tighten the easiest visible fastener and skip image verification", "Move the screen to match the shifted image without change approval"], answer: 1,
    explanation: "A lasting correction checks the physical cause and mount security before realignment, verification, and documentation.", source: sourceFor(21, "457-464"), chapter: 21,
  },
];

const auditedServiceQuestions = serviceQuestions.map((question) => {
  const cleaned = balanceChoices({
    ...question,
    prompt: polishPrompt(question),
    explanation: cleanText(question.explanation),
    choices: question.choices?.map(cleanText),
  });
  return enrichQuestion(cleaned);
});

export const questions: BaseQuestion[] = [...base, ...auditedServiceQuestions];

export const domainMeta: Record<Domain, { name: string; weight: string }> = {
  A: { name: "Creating AV Solutions", weight: "35%" },
  B: { name: "Implementing AV Solutions", weight: "30%" },
  C: { name: "Supporting AV System Operation", weight: "15%" },
  D: { name: "Servicing AV Solutions", weight: "20%" },
};

export const researchSources = [
  { label: "AVIXA CTS Exam Content Outline (2022 JTA / 2024 outline)", url: "https://a-us.storyblok.com/f/570395326227278/x/973d162aef/cts_exam_content_outline_2024.pdf" },
  { label: "AVIXA CTS Job Task Analysis (current resource link)", url: "https://a-us.storyblok.com/f/570395326227278/x/a56c3f56fb/cts_jta_2024.pdf" },
  { label: "AVIXA CTS Candidate Handbook (current download link)", url: "https://a-us.storyblok.com/f/570395326227278/x/8119693285/cts_handbook_nov_2025.pdf" },
  { label: "AVIXA CTS Sample Questions", url: "https://www.avixa.org/training-certification/courses/cts-sample-questions" },
  { label: "AVIXA — How to Prepare for Your CTS Exam (2025)", url: "https://xchange.avixa.org/posts/how-to-prepare-for-your-cts-exam-a-practical-guide" },
  { label: "AVIXA — CTS Exam Guide, Third Edition Errata", url: "https://xchange.avixa.org/posts/cts-exam-guide-3rd-ed-errata" },
  { label: "AVIXA Published Standards", url: "https://www.avixa.org/resources/standards/published-standards" },
  { label: "AVIXA Image System Contrast Ratio", url: "https://www.avixa.org/resources/standards/image-system-contrast-ratio" },
  { label: "AVIXA Audio Coverage Uniformity", url: "https://www.avixa.org/resources/standards/audio-coverage-uniformity" },
  { label: "AVIXA AV Systems Performance Verification", url: "https://www.avixa.org/resources/standards/av-systems-performance-verification" },
  { label: "AVIXA Cable Labeling for AV Systems", url: "https://www.avixa.org/resources/standards/cable-labeling-for-av-systems" },
  { label: "RFC 791 — Internet Protocol", url: "https://www.rfc-editor.org/info/rfc791/" },
  { label: "HDMI Specification Overview", url: "https://www.hdmi.org/spec/" },
  { label: "SMPTE ST 424 — 3 Gb/s SDI", url: "https://pub.smpte.org/latest/st424/st0424-2012.pdf" },
  { label: "Fluke Networks — Category Cable Termination", url: "https://www.flukenetworks.com/knowledge-base/applicationstandards-articles-copper/terminating-category-6-5e-and-5-connector" },
  { label: "Shure — Microphone Placement and Feedback", url: "https://www.shure.com/en-US/docs/guide/SM58" },
  { label: "OSHA — Electrical Grounding", url: "https://www.osha.gov/etools/construction/electrical-incidents/grounding" },
];
