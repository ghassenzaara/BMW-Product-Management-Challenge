# Signal Taxonomy: Category List

**To:** Ghassen · **From:** Amine · **Version:** `2026-10-11.1` · **Date:** 11.10.2026

Thomas (BMW AI engineer) asked that agents never invent their own themes. They should classify every signal into a **fixed list taken from BMW's VFC labels** in the customer-feedback CSV. This is that list. The full spec, prompt, JSON Schema and eval are in [`taxonomy/`](../../../taxonomy/README.md) and on the shared spec page.

## How the list works
Every finding gets three labels, each picked from a closed list:

| Level | Count | What it is | How it is set |
|---|---|---|---|
| **Car area** | 11 | Top level, for UI chips and filters | Derived from the topic in code, never predicted |
| **Topic** | 219 | BMW's VFC level-2 label ("the component") | BMW rows: lookup. Web sources: LLM restricted to this list |
| **Aspect group** | 11 | What the statement is about, grouped from BMW's 84 VFC level-3 labels | BMW rows: lookup. Web sources: LLM restricted to this list |

- **One finding = one topic.** A verbatim about the seats and the screen gives two findings.
- If nothing fits, the topic is **`other`**, which goes to a human review queue. A new topic is never created automatically.
- Counts are distinct BMW verbatims across F70, G60 and G70.

## Car areas
| ID | Label | Topics | Covers |
|---|---|---|---|
| `exterior_design` | Exterior, design & lighting | 20 | Look of the car from outside, body panels, mirrors, exterior lights, glass and wipers. |
| `interior_comfort` | Interior & comfort | 17 | Cabin look and feel, dashboard, console, ambient light, roominess, glass roof, sun protection. |
| `seats` | Seats | 8 | Seat comfort, adjustment, heating/ventilation, massage, memory, headrests, child seats. |
| `climate` | Climate | 9 | Heating, air conditioning, blower, climate controls, heated surfaces. |
| `infotainment_hmi` | Infotainment & HMI | 28 | Screens, operating concept, iDrive, navigation, audio, smartphone mirroring, voice control, displays. |
| `connectivity_digital` | Connectivity & digital (incl. AI assistant) | 26 | My BMW App, remote functions, digital key, eSIM/Wi-Fi, OTA upgrades, in-car apps, the intelligent personal assistant, phone pairing and charging. |
| `driver_assistance` | Driver assistance & safety | 34 | ADAS, parking aids, cameras, warnings, automated driving, airbags, belts, perceived safety. |
| `dynamics_powertrain` | Driving dynamics & powertrain | 31 | Engine/motor, acceleration, handling, ride, brakes, steering, transmission, drive modes, tires, start-stop. |
| `range_charging` | Range, charging & refuelling | 13 | Electric range, charging (public, home, cable, socket), high-voltage battery, fuel tank. |
| `practicality` | Practicality & access | 28 | Luggage, storage, doors, tailgate, frunk, keys and access, towing, everyday handling. |
| `quality_materials` | Quality & materials | 5 | Materials, trim, workmanship, cabin quietness, overall build of the body. |

## Topics by car area
Sorted by number of BMW verbatims. Hints are shown where BMW's label alone is ambiguous.

### Exterior, design & lighting (`exterior_design`, 20 topics)
| Topic ID | BMW label (VFC level 2) | Verbatims | Note |
|---|---|---|---|
| `exterior_design` | Exterior design | 391 |  |
| `exterior` | Exterior | 139 |  |
| `exterior_rearview_mirror` | Exterior rearview mirror | 63 |  |
| `exterior_lighting` | Exterior lighting | 62 |  |
| `welcome_light_carpet` | Welcome Light Carpet | 13 |  |
| `windshield_wiper` | Windshield wiper | 13 |  |
| `windshield` | Windshield | 12 |  |
| `flashing` | Flashing | 11 | Turn signals and hazard lights. |
| `radiator_grille` | Radiator grille | 10 |  |
| `rain_sensor_mode` | Rain sensor mode | 8 |  |
| `roof` | Roof | 8 |  |
| `bumper_rear` | Bumper, rear | 7 |  |
| `hood` | Hood | 7 |  |
| `rear_wiper` | Rear wiper | 6 |  |
| `bumper_front` | Bumper, front | 5 |  |
| `fog_light` | Fog light | 5 |  |
| `side_sill_trim_panel` | Side sill trim panel | 4 |  |
| `opening_closing_convertible_top_hardtop` | Opening / closing convertible top / hardtop | 1 |  |
| `running_board` | Running board | 1 |  |
| `wash_wipe_switch` | Wash / wipe switch | 1 |  |

### Interior & comfort (`interior_comfort`, 17 topics)
| Topic ID | BMW label (VFC level 2) | Verbatims | Note |
|---|---|---|---|
| `interior_design` | Interior design | 241 |  |
| `interior_comfort` | Interior comfort | 133 |  |
| `space_spatial_impression` | Space / spatial impression | 97 | Perceived roominess of the cabin (legroom, headroom). |
| `ambient_light` | Ambient light | 86 |  |
| `instrument_panel` | Instrument panel | 67 | Dashboard as an object: layout, look, materials. |
| `panorama_glass_roof` | Panorama glass roof | 64 |  |
| `steering_wheel` | Steering wheel | 53 | The wheel itself: rim, size, material, look. Steering feel is 'Steering'. |
| `center_console_front` | Center console, front | 52 |  |
| `interior` | Interior | 34 |  |
| `vehicle_interior_lighting` | Vehicle interior, lighting | 32 |  |
| `sun_protection` | Sun protection | 31 |  |
| `interior_rearview_mirror` | Interior rearview mirror | 19 |  |
| `center_armrest_front` | Center armrest, front | 12 |  |
| `grab_handle` | Grab handle | 12 |  |
| `sun_visor_front` | Sun visor, front | 10 |  |
| `roof_function_centre` | Roof function centre | 7 | Overhead console: reading lights, SOS button, switches. |
| `caring_car` | Caring Car | 1 | Wellness programs (vitalize / relax). |

### Seats (`seats`, 8 topics)
| Topic ID | BMW label (VFC level 2) | Verbatims | Note |
|---|---|---|---|
| `seats` | Seats | 289 |  |
| `seating_ventilate_heat` | Seating, ventilate / heat | 60 |  |
| `seat_massage` | Seat massage | 48 |  |
| `seat_memory` | Seat memory | 25 |  |
| `headrest_adjust` | Headrest, adjust | 18 |  |
| `adjustment_of_lower_lumbar_support` | Adjustment of lower lumbar support | 17 |  |
| `child_restraint_seat_use` | Child restraint seat, use | 7 | Also covers BMW label: "Child restraint seat" |
| `headrests_rear` | Headrests, rear | 4 |  |

### Climate (`climate`, 9 topics)
| Topic ID | BMW label (VFC level 2) | Verbatims | Note |
|---|---|---|---|
| `vehicle_climatization` | Vehicle, climatization | 90 |  |
| `air_conditioning_setting` | Air conditioning, setting | 47 |  |
| `blower_function` | Blower function | 43 |  |
| `heated_steering_wheel` | Heated steering wheel | 30 |  |
| `air_conditioning_control_panel` | Air conditioning control panel | 21 |  |
| `air_conditioning_overall_technology` | Air conditioning, overall technology | 17 |  |
| `panel_heating` | Panel heating | 8 |  |
| `heated_rear_window` | Heated rear window | 7 |  |
| `auxiliary_heater_function` | Auxiliary heater function | 4 |  |

### Infotainment & HMI (`infotainment_hmi`, 28 topics)
| Topic ID | BMW label (VFC level 2) | Verbatims | Note |
|---|---|---|---|
| `touch_screen_operation` | Touch screen, operation | 265 |  |
| `connecteddrive_and_infotainment_overall_technology` | ConnectedDrive and Infotainment, overall technology | 231 |  |
| `audio_mode_sound` | Audio mode, sound | 116 |  |
| `operating_concept_operating_system` | Operating concept, operating system | 111 |  |
| `owner_s_manual` | Owner's Manual | 106 | Printed or digital owner's manual, how-to information in the car. |
| `navigation` | Navigation | 103 |  |
| `apple_carplay` | Apple CarPlay | 79 |  |
| `head_up_display` | Head-Up Display | 65 |  |
| `instrument_cluster` | Instrument cluster | 60 |  |
| `driver_profile` | Driver profile | 44 |  |
| `rear_seat_entertainment` | Rear seat entertainment | 44 |  |
| `radio_function` | Radio function | 43 |  |
| `voice_control_speech_recognition` | Voice control / speech recognition | 32 |  |
| `android_auto` | Android Auto | 21 |  |
| `gesture_control` | Gesture control | 21 |  |
| `controller_operation` | Controller operation | 19 |  |
| `multi_function_steering_wheel_operation` | Multi-function steering wheel operation | 19 |  |
| `touch_command` | Touch Command | 16 | Rear-seat tablet/controls (7 Series) for comfort functions. |
| `experience_modes` | Experience Modes | 12 | Screen and ambience themes of My Modes (artwork, sounds); not the driving behaviour. |
| `real_time_traffic_information_rtti` | Real Time Traffic Information (RTTI) | 10 |  |
| `traffic_camera_information` | Traffic Camera Information | 10 |  |
| `cd_dvd_changer_playback` | CD / DVD changer, playback | 9 |  |
| `video_playback_streaming` | Video: playback / streaming | 9 |  |
| `map_update` | Map update | 8 |  |
| `display_time` | Display, time | 6 |  |
| `light_switch_operating_unit` | Light switch operating unit | 6 |  |
| `screen_mirroring` | Screen mirroring | 6 |  |
| `smart_poi_search` | Smart POI search | 5 |  |

### Connectivity & digital (incl. AI assistant) (`connectivity_digital`, 26 topics)
| Topic ID | BMW label (VFC level 2) | Verbatims | Note |
|---|---|---|---|
| `my_bmw_app_mini_app` | My BMW App / MINI App | 68 |  |
| `intelligent_personal_assistant` | Intelligent Personal Assistant | 61 |  |
| `digital_key` | Digital Key | 58 |  |
| `personal_esim` | Personal eSIM | 51 |  |
| `usb_port` | USB port | 46 |  |
| `mobile_device_wireless_charging` | Mobile device, wireless charging | 44 |  |
| `remote_software_upgrade_rsu` | Remote Software Upgrade/RSU | 44 |  |
| `manage_pair_mobile_device_bluetooth` | Manage / pair mobile device (Bluetooth) | 33 |  |
| `wifi_hotspot` | WiFi hotspot | 25 | Also covers BMW label: "Wi-Fi connection" |
| `remote_services_remote_keyless_entry_my_bmw_app_mini_app` | Remote Services & Remote Keyless Entry (My BMW App/MINI App) | 24 |  |
| `apps_in_car` | Apps (in-car) | 23 |  |
| `intelligent_personal_assistant_activation_word` | Intelligent Personal Assistant, activation word | 22 |  |
| `remote_engine_start_my_bmw_app_mini_app` | Remote Engine Start (My BMW App / MINI App) | 22 |  |
| `connecteddrive_services_smartphone_technology_overall` | ConnectedDrive services (smartphone) technology overall | 19 |  |
| `priorities_for_telephones` | Priorities for telephones | 14 |  |
| `interior_camera` | Interior camera | 13 |  |
| `bmw_connecteddrive_upgrades_mini_connected_upgrades` | BMW ConnectedDrive upgrades/ MINI CONNECTED upgrades | 12 |  |
| `remote_3d_view_my_bmw_app_mini_app` | Remote 3D View (My BMW App / MINI App) | 8 |  |
| `my_bmw_mini_portal` | My BMW / MINI Portal | 6 |  |
| `teleservices` | Teleservices | 6 | Service intervals and remote service notifications. |
| `remote_interior_camera_my_bmw_app_mini_app` | Remote interior camera (My BMW App / MINI App) | 5 |  |
| `display_key` | Display key | 4 | BMW key fob with a display. |
| `bmw_online_mini_online` | BMW Online / MINI Online | 2 |  |
| `customer_account_my_bmw_mini_portal` | Customer Account (My BMW / MINI Portal) | 2 |  |
| `driver_s_guide_app` | Driver's Guide App | 2 |  |
| `apps_smartphone` | Apps (smartphone) | 1 |  |

### Driver assistance & safety (`driver_assistance`, 34 topics)
| Topic ID | BMW label (VFC level 2) | Verbatims | Note |
|---|---|---|---|
| `impression_of_safety` | Impression of safety | 104 | How safe the car feels overall. |
| `driver_assistance_automated_driving_overall_technology` | Driver assistance, automated driving, overall technology | 86 |  |
| `highway_assistant` | Highway assistant | 76 |  |
| `active_cruise_control` | (Active) cruise control | 65 |  |
| `parking_assistant` | Parking Assistant | 58 |  |
| `rear_view_camera` | Rear view camera | 37 |  |
| `lane_departure_warning` | Lane departure warning | 32 |  |
| `park_distance_control_pdc` | Park Distance Control (PDC) | 29 |  |
| `vehicle_safety_overall_technology` | Vehicle safety, overall technology | 29 |  |
| `steering_and_lane_guide_assist` | Steering and lane guide assist | 27 |  |
| `surround_view` | Surround View | 27 |  |
| `seat_belts` | Seat belts | 25 |  |
| `all_round_view` | All-round view | 23 |  |
| `speed_limit_assistant` | Speed Limit Assistant | 22 |  |
| `drive_recorder` | Drive Recorder | 21 |  |
| `back_up_assistant` | Back-up Assistant | 19 |  |
| `blind_spot_monitoring` | Blind spot monitoring | 17 |  |
| `front_collision_warning` | Front collision warning | 17 |  |
| `remote_controlled_parking` | Remote controlled parking | 17 |  |
| `emergency_request` | Emergency request | 16 |  |
| `cross_traffic_warning_rear_with_brake_intervention` | Cross Traffic Warning Rear with Brake Intervention | 14 |  |
| `fatigue_alert` | Fatigue Alert | 14 |  |
| `anti_theft_alarm_system` | Anti-theft alarm system | 12 |  |
| `high_beam_assistant` | High-beam assistant | 12 |  |
| `lane_change_assistant` | Lane Change Assistant | 11 |  |
| `child_safety_latch` | Child safety latch | 10 |  |
| `night_vision` | Night Vision | 8 |  |
| `side_view` | Side View | 8 |  |
| `traffic_light_and_sign_warning` | Traffic Light And Sign Warning | 8 |  |
| `rear_end_collision_warning` | Rear-end collision warning | 6 |  |
| `airbags` | Airbags | 5 |  |
| `emergency_stop_assistant` | Emergency Stop Assistant | 4 |  |
| `traffic_jam_assistant` | Traffic Jam Assistant | 4 |  |
| `intersection_warning_with_brake_intervention` | Intersection Warning with Brake Intervention | 3 |  |

### Driving dynamics & powertrain (`dynamics_powertrain`, 31 topics)
| Topic ID | BMW label (VFC level 2) | Verbatims | Note |
|---|---|---|---|
| `drivetrain` | Drivetrain | 1,287 | Engine/motor power, acceleration, fuel or energy efficiency of the propulsion system. |
| `drive_driving_dynamics_and_chassis_overall_technology` | Drive, driving dynamics and chassis, overall technology | 692 | Overall driving feel: sportiness, agility, 'fun to drive'. |
| `handling_riding` | Handling / Riding | 689 | Ride comfort and handling on the road. |
| `my_modes_driving_experience` | My Modes / driving experience | 159 | BMW My Modes: selectable driving/experience modes (Sport, Efficient, Personal). |
| `cushioning_damping_vehicle` | Cushioning / damping vehicle | 103 |  |
| `braking` | Braking | 96 |  |
| `wheels_tires` | Wheels / tires | 87 |  |
| `automatic_engine_start_stop_function_msa` | Automatic engine start-stop function (MSA) | 83 |  |
| `transmission` | Transmission | 64 |  |
| `engine_acoustics_engine_sound` | Engine acoustics / engine sound | 53 |  |
| `steering` | Steering | 53 |  |
| `resting_state_after_door_opening` | Resting state after door opening | 34 | Vehicle wake/sleep behaviour: car stays on or switches off when doors open, settings not retained. |
| `brake_energy_regeneration_recuperation` | Brake Energy Regeneration / recuperation | 28 | Regenerative braking, one-pedal feel of electrified cars. |
| `operate_selector_lever` | Operate selector lever | 27 |  |
| `automatic_hold` | Automatic-hold | 25 |  |
| `rsc_tire` | RSC tire | 22 |  |
| `vehicle_battery` | Vehicle battery | 21 | 12 V battery and its warnings. The high-voltage battery is range_charging. |
| `ground_clearance` | ground clearance | 19 |  |
| `tire_pressure_control` | Tire pressure control | 17 |  |
| `parking_brake` | Parking brake | 15 |  |
| `self_leveling_suspension` | Self-leveling suspension | 15 |  |
| `tirefit` | Tirefit | 14 |  |
| `starting_engine` | Starting engine | 13 |  |
| `pedals_operate` | Pedals, operate | 12 |  |
| `start_engine_switch_on_drive_readiness` | Start engine/switch on drive readiness | 12 |  |
| `dynamic_stability_control` | Dynamic Stability Control | 11 | Also covers BMW label: "Dynamic Stability Control (DSC)" |
| `shift_paddle` | Shift paddle | 11 |  |
| `cooling` | Cooling | 10 | Engine or drivetrain cooling (overheating, coolant). Cabin cooling is climate. |
| `engine_oil` | Engine oil | 10 |  |
| `launch_control` | Launch Control | 9 |  |
| `exhaust_system` | Exhaust system | 7 |  |

### Range, charging & refuelling (`range_charging`, 13 topics)
| Topic ID | BMW label (VFC level 2) | Verbatims | Note |
|---|---|---|---|
| `electric_range` | Electric Range | 166 |  |
| `public_charging_external_providers` | Public charging / external providers | 77 |  |
| `charge_high_voltage_battery` | Charge high-voltage battery | 57 |  |
| `high_voltage_battery` | High voltage battery | 40 |  |
| `wallbox_charging_home_charging` | Wallbox, charging / home charging | 34 |  |
| `opening_closing_charging_socket_cover` | Opening/closing charging socket cover | 23 |  |
| `fuel_filler_flap_open_close` | Fuel filler flap , open / close | 17 |  |
| `high_voltage_battery_preconditioning` | High voltage battery, preconditioning | 16 |  |
| `charging_cable` | Charging cable | 15 |  |
| `fuel_tank` | Fuel tank | 14 |  |
| `high_voltage_charging_power_socket` | High-voltage charging power socket | 13 |  |
| `route_optimized_for_charging` | Route optimized for charging | 12 |  |
| `bidirectional_charging` | Bidirectional charging | 1 |  |

### Practicality & access (`practicality`, 28 topics)
| Topic ID | BMW label (VFC level 2) | Verbatims | Note |
|---|---|---|---|
| `luggage_compartment` | Luggage compartment | 78 |  |
| `door_open_close` | Door, open / close | 77 |  |
| `trunk_lid_open_close` | Trunk lid, open / close | 66 | Also covers BMW label: "Trunk lid" |
| `vehicle_key` | Vehicle key | 61 |  |
| `automatic_doors` | Automatic doors | 59 |  |
| `non_contact_trunk_lid_opening` | non-contact trunk lid opening | 54 |  |
| `vehicle_lock_unlock` | Vehicle, lock / unlock | 51 |  |
| `comfort_access` | Comfort Access | 45 |  |
| `vehicle_access_and_exit` | Vehicle, access and exit | 35 |  |
| `garage_door_opener` | Garage door opener | 33 | Also covers BMW label: "Interior mirror, garage door opener" |
| `glove_box` | Glove box | 30 |  |
| `storage_compartments` | Storage compartments | 30 |  |
| `cupholder` | Cupholder | 29 |  |
| `door_front` | Door, front | 26 |  |
| `side_window_open_close` | Side window, open / close | 21 |  |
| `accessories_parts` | Accessories / Parts | 20 | BMW accessories and spare parts (roof rack, cargo net, tray tables). |
| `outer_door_handle_front` | Outer door handle, front | 14 |  |
| `remote_engine_start_vehicle_key` | Remote Engine Start (Vehicle Key ) | 14 |  |
| `frunk` | Frunk | 13 |  |
| `towing_eye` | Towing eye | 11 |  |
| `12_v_connection` | 12 V connection | 10 |  |
| `hood_open_close` | Hood, open / close | 10 |  |
| `washer_fluid_top_up` | Washer fluid, top up | 9 |  |
| `through_loading_facility` | Through-loading facility | 7 |  |
| `trailer_use` | Trailer, use | 6 |  |
| `trunk_light` | Trunk light | 6 |  |
| `horns` | Horns | 5 |  |
| `outer_door_handle_rear` | Outer door handle, rear | 4 |  |

### Quality & materials (`quality_materials`, 5 topics)
| Topic ID | BMW label (VFC level 2) | Verbatims | Note |
|---|---|---|---|
| `body_equipment_overall_technology` | Body equipment, overall technology | 482 | General equipment level and overall build/technology of the body. |
| `interior_acoustics` | Interior acoustics | 63 | Cabin quietness and noise insulation. |
| `door_finisher_panel_front` | Door, finisher panel, front | 23 |  |
| `upholstery_interior_trim` | Upholstery / interior trim | 22 |  |
| `floor_mat` | Floor mat | 14 |  |

## Special labels
| Topic ID | BMW label | Status | What happens |
|---|---|---|---|
| `other` | (none) | fallback | Nothing in the list fits. Goes to the taxonomy review queue; never invent a new topic. |
| `general_enquiry_customer_feedback` | General enquiry: customer feedback | meta | General remark without a specific feature. Re-classify from the text; if nothing specific, use other. |
| `no_class_found` | no_class_found | meta | BMW's 'no class found'. Re-classify from the text. |

BMW's own list also has 5 exact duplicates (aliases). Each one points to a single topic and is listed under "Also covers" in the tables above.

## Aspect groups
| ID | Meaning | BMW VFC level-3 labels |
|---|---|---|
| `function` | Does the feature exist and do its job (incl. missing equipment). | Like: function, Customer request: function, Vehicle equipment: not available, Like: vehicle equipment, too few, Information / accuracy insufficient, Customer request: compatibility |
| `usability` | How easy it is to operate; ergonomics; can't switch it off. | Not user-friendly, Like: usability, Customer request: usability, Ergonomics do not appeal, Installation and set-up: difficult, Operating force not OK, Permanent switch-off not possible, Switch off not possible, Accidental triggering |
| `reliability` | Defects, faults, things that stop working. | Malfunction, Connection fault, Blank / frozen screen, Battery discharge, Communication fault, Locking, detent: fault, Fitting fault, Installation: fault, Opening, closing: not possible / not complete, Warning / notification active, Reception quality not OK, Capacity loss |
| `performance` | Power, speed, responsiveness, strength of an effect. | Like: performance, Drive power/driving performance not OK, Effect, power not OK, Like: responsiveness, Response characteristics: too sluggish, Response characteristics not OK, Response characteristics: too fast, Response characteristics: too jerky/too abrupt, Too slow, Shift characteristics not OK, Drivability not OK, Customer request: performance, Pulls to one side, Light intensity not OK |
| `efficiency_range` | Consumption, efficiency, electric range, charging infrastructure. | Like: Efficiency, Fuel / power consumption too high, Range, not OK, Like: Range, Information / Accuracy insufficient (electric range), Charging infrastructure inadequate |
| `design` | Look and styling. | Look / design appeals, Customer request: design |
| `comfort` | Physical comfort. | Likes comfort, Not comfortable, Customer request: comfort, Like: odor |
| `space` | Size, room, storage, view. | insufficient storage space, Size not user friendly, Like: Space / spatial impression, Likes size, Like: storage space, Customer request: space / spatial impression, Customer request: size, View/restricted panoramic view, Like: view/panoramic view |
| `quality` | Materials, workmanship, damage, leaks, rattles, smells. | Damage, Workmanship appeals, Workmanship does not appeal, Customer request: material quality, Dirty contamination, Leak, Leak: water ingress/condensation, Leak: air, Condensation, Cavity sealant: wax residue, Stiff movement, Odor/smoke, Vibration, oscillation, Excessive opening |
| `sound` | Noise and sound. | Noise, Wind noise, Like: sound, Customer request: sound |
| `price` | Price-performance, standard vs. paid option. | Like: price-performance ratio, Dislike: price-performance ratio, Vehicle equipment: not standard / too costly |

## To align with you
Your backend already has its own car-area list (`backend/seed/review/car_areas.csv`, 15 areas, e.g. separate Lighting, Safety, Access). The car areas above are the 11 the web demo uses. Before you wire this in, let's pick one list. The topics stay the same either way; only the topic → car area column in `taxonomy/topics.csv` changes.

Mapping calls worth a second look:
- The digital key and the display key are under connectivity, while the physical key, Comfort Access and lock/unlock are under practicality.
- Regenerative braking and the 12 V battery are under driving dynamics; the high-voltage battery and the fuel tank are under range.
- `Body equipment, overall technology` is under quality.
- Quality & materials has few topics on purpose. Quality is mostly an aspect (`aspect_group = quality`) that applies across all areas.
