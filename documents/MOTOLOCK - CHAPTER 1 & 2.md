

**MotoLock: An IoT-Based Alcohol Detection and Safe-Ride System**

A Capstone and Research Presented to the

Faculty of the College of Computer Studies

Dr. Yanga’s Colleges, Inc.

Bocaue, Bulacan

In Partial Fulfillment of the Requirements

for the Degree of Bachelor of Science

in Information Technology 

by

Basilio, Riezseht, B.

Santiago, Ayianna Rhei, M.

Sudaria, Ariane, R.

March 2026

**CHAPTER 1**

**PROJECT RATIONALE**  
**Introduction**  
Road traffic accidents continue to be a major global public health problem that causes millions of preventable deaths each year, devastating families and disrupting communities. According to the World Health Organization (2023), approximately 1.19 million people died due to road traffic accidents in 2021, with motorcycles accounting for 30% of these fatalities and alcohol consumption contributing to nearly 10% of crashes worldwide. Beyond these statistics, predicting driver behavior and understanding the underlying factors related to drink-driving remain major challenges for researchers striving to improve road safety (Smailović et al., 2023). These alarming figures highlight the urgent need for innovative and technology-driven approaches to reduce accidents caused by intoxicated driving.  
The negative effects of drunk driving are also evident in the Philippines, where a sudden 90% increase in road crashes caused by drunk drivers in late 2022 prompted stricter enforcement of anti-drunk driving laws (Tupas, 2022). This alarming national trend is similarly reflected in Cauayan City, Isabela. From 2020 to 2024, vehicular accidents in the area surged to 4,016 recorded incidents, with motorcycles involved in most cases and driving under the influence identified as the leading contributing factor (Sebastian & De Castro, 2025). As students witnessing these preventable accidents within the community, there is an urgent need to develop safer transportation practices and technological interventions that can help protect motorists and pedestrians alike.  
Despite the implementation of police checkpoints and ignition lock systems, existing technological solutions for drunk driving prevention still possess significant limitations. Many systems rely on single alcohol sensors that are vulnerable to false positives caused by alcohol-based sanitizers, perfumes, or environmental interference. Additionally, these systems can be bypassed when another person performs the breath test on behalf of the intoxicated driver (Celaya-Padilla et al., 2021). Most existing studies also focus on enclosed vehicle environments and fail to address the unique challenges faced by motorcycles operating in open-air conditions, where wind can affect alcohol detection accuracy. Furthermore, traditional ignition lock systems often consume excessive battery power and lack real-time emergency notification features. These limitations reveal the need for a more reliable, intelligent, and motorcycle-specific safety system.  
To address these identified gaps, this study proposes the development of “MotoLock: An IoT-Based Alcohol Detection and Safe-Ride System.” The study aims to develop a reliable motorcycle safety system that utilizes an MQ-3 gas sensor, computer vision-based identity verification, GPS tracking, and a web-based alert mechanism to prevent intoxicated individuals from operating motorcycles. By integrating smart and preventive technologies, the proposed system seeks to reduce motorcycle-related accidents caused by alcohol impairment and promote safer road environments within the community. Furthermore, this study supports the United Nations Sustainable Development Goal (SDG) 3: Good Health and Well-Being, particularly Target 3.6, which aims to significantly reduce road traffic deaths and injuries through effective preventive measures and safer transportation systems.  
**Review of Related Literature and Studies**   
**Related Literature**   
***Effects of Alcohol on Driving Behavior** *  
Driving under the influence of alcohol remains a major cause of road accidents. Recent meta-analyses have extensively quantified the risks associated with alcohol consumption on the road. Høye and Storesund Hesjevoll (2023) conducted a comprehensive meta-analysis to determine the correlation between blood alcohol concentration (BAC) and crash risk. Their findings revealed that crash risk increases exponentially even at low BAC levels, emphasizing the need for strict preventive interventions. Similarly, Simmons et al. (2022) analyzed the effects of alcohol and cannabis on driver behavior and found that alcohol causes more severe impairment in motor skills, particularly in lane control and reaction time. Supporting this, Smailović et al. (2023) identified behavioral and environmental factors that significantly influence the likelihood of drunk driving, highlighting the importance of predictive and preventive safety systems. Furthermore, Dong et al. (2024) examined the effects of alcohol in both manual and semi-automated driving environments and found that intoxicated drivers are still unable to safely take control during system failures. These studies collectively confirm that alcohol significantly impairs driving ability and that preventive technologies are essential for improving road safety. In the Philippines, Tupas (2022) reported that road crashes caused by drunk driving increased by 90%, highlighting the growing need for stricter road safety measures and preventive technologies for motorists. Similarly, Sebastian and De Castro (2025) examined the prevalence and resolution of road incidents in Cauayan City, Isabela, emphasizing the importance of effective monitoring, emergency response, and safety interventions in reducing road-related incidents. These studies further support the need for systems such as MotoLock that aim to prevent alcohol-related motorcycle accidents and improve rider safety.  
***Alcohol Detection Technologies** *  
In response to these risks, researchers have explored various alcohol detection technologies for vehicular applications. Paprocki, Qassem, and Kyriacou (2022) reviewed multiple sensing approaches, including breath, blood, transdermal, and optical methods. Their findings indicate that breath-based detection remains the most practical and effective solution for real-time vehicle integration. Brobbin et al. (2022) further evaluated wearable transdermal sensors and found that although they provide continuous monitoring, they suffer from delayed detection, making them less suitable for immediate applications such as ignition control systems. To improve detection accuracy, Kumar and Kumar (2022) examined modern drunk driving detection systems and concluded that relying solely on gas sensors often leads to false positives. They recommended integrating additional validation methods, such as computer vision, to create more reliable and robust detection systems. Furthermore, maintaining sensor accuracy in varying environmental conditions remains a significant challenge. Santos, Carmo, and Prado (2022) identified that environmental factors and aging heavily contribute to the inaccuracy and failure of breathalyzers, highlighting the necessity of mitigating open-air interference such as wind to ensure reliable readings. ***Fail-Safe and Manual Override Mechanisms** *  
Safety-critical embedded systems require mechanisms that allow the system to respond properly during faults, malfunctions or unexpected failures. According to IEC 61508\. (2010), functional safety focuses on electrical, electronic, and programmable electronic system that perform safety related function where failure may cause harm to people, property, or the environment. This supports the needs for MotoLock to include safety measures that can respond to hardware or system malfunction without weakening the main alcohol-locking function.  
Fail-safe systems are designed to move into a safer condition when fault occurs. Siemens. (2024) describes fail-safe automations systems as systems used in application where failures may affect human safety or the environment, with the goal of reducing hazards to a tolerable level. In the MotoLock system, this concept supports the use of a controlled manual override only during hardware or system malfunction, while still keeping the motorcycle locked when alcohol is detected.   
Fault-tolerant embedded system design also emphasizes error detection, recovery strategies, redundancy, and safe-sate behavior. Recent studies on fault tolerance in embedded systems explains that fault tolerance helps maintain correct operations despite hardware or software faults, especially in real-time and interconnected systems. Alhammad et al. (2024) This is relevant to MotoLock because the system depends on sensors, relay control, GPS/GSM communication, and microcontroller operations that may experience malfunction during actual use.  
Automotive functional safety principle also supports the idea that a system must detect faults and transitions to a safe state within an acceptable time. ISO 26262-related discussion describe fault reaction time and safe-state transition as important concepts in road vehicle safety systems. Optima Design Automation. (2019). For MotoLock, this means the override should not be treated as a shortcut for failed alcohol detection, but as recovery feature when the hardware itself fails.   
***Integrated and IoT-Based Safety Systems** *  
As sensing technologies evolve, their integration into interconnected vehicular systems has become increasingly important. Visconti et al. (2025) explored driver monitoring systems within the Internet of Vehicles (IoV) and found that combining cameras, sensors, and cloud-based analytics enables proactive road safety solutions. Muslam (2024) emphasized the importance of secure communication in these systems, noting that while vehicle-to-vehicle (V2V) communication improves traffic management, it also introduces cybersecurity risks that must be addressed through robust encryption protocols. Additionally, Tafidis et al. (2022) highlighted that while automated vehicles may reduce human-error accidents in the future, current mixed-traffic environments still require advanced safety mechanisms for human-driven vehicles. These studies demonstrate that modern road safety systems are shifting toward connected, intelligent, and preventive technologies. To address the performance requirements of these interconnected systems, modern IoT applications are increasingly shifting toward serverless architectures. Tusa et al. (2024) demonstrated that microservices and serverless functions significantly improve the lifecycle, performance, and resource utilization of edge-based real-time IoT analytics, providing a highly scalable and low-latency infrastructure essential for vehicular monitoring. **Relevance to the Proposed System**   
These identified gaps directly support the development of the MotoLock system. By integrating an MQ-3 gas sensor with computer vison-based identity verification, the proposed system addresses the limitations of single-sensor approaches and prevents unauthorized bypass. Additionally, the inclusion of real-time GPS tracking and web-based alert systems aligns with current IoT trends in vehicular safety. Most importantly, the system is specifically designed for motorcycles, addressing the lack of research focused on open-air vehicle environments.  
Furthermore, studies on a fail-safe and fault-tolerant embedded systems support the inclusion of a controlled manual override mechanism within the MotoLock system. According to Siemens (2024), fail-safe systems are designed to maintain safety during hardware or system malfunction by transitioning into controlled recovery operations. Similarly, Armoush (2009) emphasized that embedded safety systems should implement recovery and fallback mechanisms to prevent total system failure while maintaining operational reliability. In the proposed MotoLock system, the manual override mechanism is intended only for hardware or system malfunction and not as a means to bypass alcohol detection. When alcohol intoxication is detected, the ignition lock remains enforced and override options are disabled to preserve and preventive purpose of the system. Through this approach, the study contributes a practical, secure, and motorcycle-specific solution for reducing drunk driving incident and improving emergency response capabilities among motorcycle riders.  
**Related Studies**   

***Ignition Interlock Devices (IID) and Cross-Vehicle Applications***  
The concept of preventing an intoxicated driver from starting a vehicle has been extensively studied and implemented in four-wheeled vehicles through Ignition Interlock Devices (IIDs). According to the National Highway Traffic Safety Administration (NHTSA, 2024), breathalyzer-based interlocks are highly effective in reducing repeat drunk driving offenses by requiring a passed breath test prior to authorizing engine start. While these studies primarily focus on cars, the core authorization mechanism and the electrical schematic for interrupting the ignition system are fundamentally similar. Adapting this established IID concept to motorcycles requires addressing unique challenges, such as the open-air environment and the potential for manual bypasses (e.g., kick-starting), but the underlying principle of disabling the ignition circuit to prevent starting remains a proven safety intervention.

***IoT-Based Alcohol Detection and Engine Lock Systems***   
To address the serious damage caused by drunk driving, several studies have focused on developing IoT-based alcohol detection systems integrated with engine control mechanisms. Aminboevich and Ugli (2025) developed a real-time alcohol detection and engine locking system using an Arduino Uno microcontroller and an MQ-3 sensor mounted on the steering wheel. Their findings showed that when the driver’s breath alcohol concentration exceeded the threshold, the engine was automatically shut down and an alarm was triggered. The study concluded that such systems provide an efficient and low-cost safety solution and recommended their integration into various vehicle types. Similarly, Nanda and De (2022) designed a system combining an MQ-3 sensor, GPS, and GSM modules to detect alcohol and send real-time alerts. Their findings revealed that the system could accurately detect alcohol and immediately stop the engine while sending SMS notifications with location data. The researchers concluded that integrating detection with communication enhances road safety and recommended policy-level adoption.    
Shankar et al. (2023) further emphasized real-time tracking by integrating GPS with an engine locking mechanism. Their study showed that upon alcohol detection, the engine was disabled and location data was sent to emergency contacts. The researchers concluded that automated systems without time or location limitations significantly improve accident prevention. However, Rafidi and Ismail (2021) identified limitations in MQ-3-based systems, noting inconsistencies and false readings despite calibration. They concluded that while ignition lock systems are effective, improvements in sensor accuracy and additional features such as automated alerts are necessary.  
***Smart Helmet-Based Alcohol Detection Systems***  
Recent studies have also explored the integration of alcohol detection systems into motorcycle helmets to improve rider safety and prevent drunk driving. Abd Wahab et al. (2022) developed a smart helmet equipped with an MQ-3 alcohol sensor that prevents motorcycle ignition when alcohol is detected from the rider’s breath. Their findings showed that integrating alcohol detection directly into the helmet improves detection proximity and reduces the possibility of system bypassing. Similarly, Aher et al. (2023) designed an IoT-based smart helmet that combines helmet verification and alcohol sensing to ensure that riders are both wearing helmets and free from alcohol impairment before ignition is enabled. The researchers concluded that helmet-integrated systems provide an additional layer of safety for motorcycle riders. These studies collectively highlight the growing use of helmet-based alcohol detection technologies as practical and motorcycle-specific approaches to road safety.  
***Microcontrollers, Connectivity, and System Performance***   
To improve system efficiency, Hosan et al. (2025) compared ESP32 and Arduino Uno microcontrollers. Their findings showed that ESP32 performs faster and handles multiple processes more efficiently. The study concluded that ESP32 is more suitable for complex IoT systems. Supporting this, Rahman et al. (2026) explored the communication capabilities of ESP32 and found that its built-in Wi-Fi and Bluetooth simplify system design. The researchers concluded that ESP32 enhances connectivity and is ideal for modern IoT applications.   
***Hardware Reliability and Electrical Safety***   
Ensuring system safety is also critical. ESP Boards (2026) examined relay modules with optocouplers and found that they effectively protect microcontrollers from high voltage damage. The study recommended using optocoupler relays for safer system design.    
Rogers and Murray (2022) compared mechanical and solid-state relays, concluding that while solid-state relays offer durability, mechanical relays are more suitable for high-power applications. They recommended selecting relay types based on system requirements. In terms of power efficiency, Texas Instruments (2023) analyzed the LM2596 buck converter and found it significantly reduces energy loss compared to linear regulators. The study recommended its use in IoT systems requiring stable voltage supply.   
***GPS, GSM, and Communication Systems***   
Accurate tracking and communication are essential features of vehicular safety systems. Üremek et al. (2024) compared GPS modules and found that newer models like NEO-M8N provide higher accuracy and better satellite connectivity. Similarly, Baig et al. (2022) found that newer GPS modules achieve faster signal acquisition, making them suitable for real-time applications.    
Rao and Sundari (2022) demonstrated that GSM modules can reliably send SMS alerts even without internet connectivity. Their study concluded that GSM remains a practical solution for remote monitoring systems. Supporting this, Salih and Alsaedi (2023) found that newer GSM modules like SIM800L are more energy-efficient due to sleep mode features.   
***Display and User Interface Technologies***   
Zhao et al. (2023) compared OLED and LCD displays and found that OLED provides better contrast and readability under different lighting conditions. Liang (2024) further supported this by showing that OLED consumes less power. Both studies concluded that OLED displays are more suitable for compact IoT systems.   
***Manual Override as Recovery Mechanism***   
Armoush. (2009) discussed safety-critical embedded system design patterns and explained that such systems often require monitoring, failure detection, and safe fallback mechanisms. The study supports the use of structured recovery mechanisms in embedded systems to prevent total system failure while maintaining safety requirements. This relates to MotoLock’s manual override because the feature acts as a fallback mechanism only when the system or hardware malfunctions, not when the rider fails the alcohol test.  
A recent survey on fault tolerance methods in embedded systems found that modern embedded systems use software-based mitigation, redundancy, and recovery mechanisms to handle faults. Alhammad et al. (2024). These techniques are important in real-time systems because hardware and software failures can affect reliability. In the proposed MotoLock system, the manual override can be justified as a recovery mechanism for malfunction cases, while system logs preserve accountability.  
System safety literature also explains that fail-safe design should cause the system to enter a safe state when problems occur. MIT OpenCourseWare. (2016) notes that fail-safe safeguards are designed so that systems fail into safer conditions. This supports MotoLock’s rule that alcohol-positive detection must keep the ignition locked, while manual override should only be considered when the system fault is technical rather than alcohol-related.

***Advanced Detection Systems and Emerging Technologies***   
To improve detection accuracy, Abu Al-Haija and Krichen (2022) proposed a machine learning-based system using multiple MQ-3 sensors. Their findings showed a detection accuracy of 99.8% with minimal delay. The study concluded that integrating AI significantly enhances system performance. Farooq et al. (2023) introduced a blockchain-based IoT framework to secure alcohol detection data. Their findings showed that blockchain ensures data integrity and prevents tampering. The researchers recommended adopting decentralized systems for secure vehicular monitoring.    
Alsayaydeh et al. (2023) expanded system functionality by combining alcohol detection with overspeed monitoring. Their study demonstrated high accuracy in detecting both conditions and concluded that multi-feature systems provide better accident prevention.   
Wang et al. (2025) addressed false positives by developing a non-intrusive multi-sensor system. Their findings showed 100% accuracy with no false alarms even under interference. The study recommended advanced sensor designs for improved reliability. Jorakulyyev et al. (2025) focused on sustainability by developing rechargeable alcohol detectors. Their study found that these devices maintain accuracy while reducing waste. The researchers recommended integrating rechargeable systems into future designs. Furthermore, while facial recognition offers an additional layer of security, traditional 2D authentication systems are highly vulnerable to presentation attacks. Wu et al. (2023) demonstrated that 3D face authentication can be successfully spoofed using 2D photos, emphasizing the necessity of integrating robust liveness detection mechanisms to prevent unauthorized bypassing of biometric security measures. ***User Acceptance and Adoption***   
Finally, Kingsley et al. (2023) examined public acceptance of in-vehicle safety technologies. Their findings showed that users generally support alcohol detection systems, but adoption depends on usability and awareness. The study concluded that user education is essential for successful implementation.   
**Synthesis**   
Overall, the reviewed studies show a clear shift toward proactive, technology-driven solutions for preventing drunk driving. IoT-based systems combining MQ-3 sensors, microcontrollers, and smartphone-based GPS and internet connectivity have proven effective in detecting alcohol and preventing vehicle operation. However, limitations such as sensor inaccuracies due to environmental interference, system bypassing via photo spoofing, hardware reliability issues, and the need for scalable real-time analytics remain significant challenges. Recent literature on fail-safe and fault-tolerant embedded systems also emphasized the importance of recovery mechanisms and safe-state transitions during hardware or system malfunction. These gaps highlight the importance of the MotoLock system. By enclosing the sensor within the helmet to prevent wind interference, integrating liveness detection through Human.js to prevent spoofing, utilizing a serverless PostgreSQL database (Supabase) for real-time analytics, and providing a controlled manual override mechanism intended only for hardware or system failure, the proposed study directly addresses the limitations identified in previous research and contributes to the advancement of intelligent vehicular safety systems.  
**Statement of the Problem **   
***General Problem***   
How can a system be designed and developed to help motorcycle drivers ride safely by detecting alcohol use and verifying driver identity and sending alerts to emergency contacts in real time? 

***Specific Problem***   
Specifically, it seeks to answer the following questions:

1. How can the system accurately detect and validate a driver’s identity liveness detection and alcohol intake level via the MQ-3 sensor before riding?   
2. How can the devices be safely installed on the motorcycle to work reliably under different environmental conditions?   
3. How can the system ensure that alcohol detection and identity verification work together in real-time?   
4. To what extent do riders find the system easy to use and interact with during everyday riding?   
5. How useful do riders and their designated companions perceive the system in preventing drunk driving and improving emergency response?   
6. How well does the system perform in terms of functional stability, reliability, compatibility, performance efficiency, interaction capability, flexibility, safety, maintainability, and security when monitoring and sending alerts in real time?   
7. How do the evaluations of the MotoLock system differ in terms of user acceptance, system quality, and efficiency when respondents are grouped according to user type?

**Objectives of the Study**   
***General Objective***   
To design and develop a system that ensures the safety of motorcycles by detecting alcohol use and verifying driver identity and providing real-time alerts to emergency contacts.   
***Specific Objectives*** 

1. To accurately detect alcohol consumption and verify the driver's identity through facial recognition before riding.   
2. To design a safe and reliable device setup that can be installed on motorcycles and withstand environmental conditions.   
3. To ensure seamless coordination between alcohol detection identity verification and ignition lock activation in real time.   
4. To determine the ease of use of the system for motorcycle riders during everyday riding.   
5. To assess the perceived usefulness of the system in preventing drunk driving and improving emergency response for riders and their companions.   
6. To evaluate the system's performance in terms of functional stability, reliability, compatibility, performance efficiency, interaction capability, flexibility, safety, maintainability, and security when monitoring via the web dashboard and sending alerts via the mobile app.   
7. To determine whether there is a significant difference in the evaluation of the MotoLock system in terms of user acceptance, system quality, and efficiency when respondents are grouped according to user type.  
   

**Scopes and Delimitation**   
***Scope***   
**User Management and Authentication Module:**   
The User Management and Authentication Module allow riders to create an account, set up a 4-digit security PIN, register motorcycle information, add emergency contacts, and pair the mobile application with the MotoLock hardware through Bluetooth. The security PIN is used only for account protection and login confirmation before accessing the dashboard. This module also enables administrators to manage user accounts, system settings, access control, and data backup through a centralized control panel.  
**Identity Validation Module:**   
The Identity Validation Module verifies the registered rider through facial recognition using two facial profile setups: one without helmet and one with helmet. During registration, the rider is required to capture facial data in both conditions to improve recognition accuracy during actual motorcycle use. This process confirms the rider’s physical presence and prevents spoofing attempts. To maintain accuracy in different environments, the module automatically adjusts screen brightness or activates the flash in low-light conditions. It strictly enforces the validation sequence to ensure that the individual attempting to start the motorcycle matches the registered user. Additionally, the module utilizes local mobile processing to perform facial recognition and liveness detection, allowing identity verification even without an internet connection.   
**Engine Lock Control Module:**   
The Engine Lock Control Module is responsible for managing the motorcycle’s ignition based on the results of identity verification and alcohol detection. To prevent bypass methods such as kick-starting or push-starting the motorcycle, the system activates a physical relay to completely disable the ignition circuit if alcohol is detected or if the rider’s identity cannot be verified. Crucially, as a safety measure, this interlock is designed to engage only *before* starting; it will never cut off the ignition of an already moving or running motorcycle to avoid accidents. It enforces safety protocols such as a 5-minute cool-down period after a failed attempt lockout if the rider fails two consecutive verification attempts. The system maintains a Secure-Lock state during failed tests or signal loss, preventing unauthorized engine access until a successful local identity verification and breath analysis are completed. The module also includes a manual override mechanism that allows the rider to temporarily bypass ignition lock restrictions only during hardware and system malfunction or emergency system failure. Override activities are automatically logged by the system for monitoring and accountability purposes.  
**Helmet-Based Hardware Module:**  
The Helmet-Based Hardware Module contains the MQ-3 alcohol sensor and IR sensor installed inside the rider’s helmet. The IR sensor detects whether the rider is properly wearing the helmet before allowing the alcohol detection process to proceed. If the rider is not detected, the OLED screen displays a “Rider Not Detected” message, and the MQ-3 sensor will remain inactive. This prevents the rider from taking the 

breath test unless the helmet is properly worn. The module improves safety and convenience by placing the alcohol detection hardware inside the helmet, and it is also rechargeable for continued use.  
**Emergency Contact Notification and Alert Module:**   
The Emergency Contact Notification and Alert Module ensure timely communication with the rider’s designated contacts during critical situations. In the event of a failed sobriety test or lock violation, the system automatically sends SMS notifications containing the rider’s location and detected alcohol level. Manual override functionality remains unavailable during alcohol-positive cases and may only be activated during verified hardware or system malfunction. The module also implements a cascading alert protocol, where secondary contacts are notified if the primary contact is unresponsive. Additionally, the system provides direct access to ride-hailing services such as Grab or JoyRide, offering the rider a safe alternative for transportation.  
**Reports Module:**   
The Reports Module enables administrators to generate and export comprehensive compliance reports on a weekly or monthly basis in formats such as PDF or Excel for official documentation. It compiles detailed system activity logs, including user access records, timestamps, and system events, to ensure complete transparency and accountability. This module supports audit tracking by maintaining a structured record of all interactions within the system, allowing administrators to review and monitor system usage effectively. 

**Predictive Analytics Module:**   
The Predictive Analytics Module processes collected system data to generate visual trends and insights related to rider behavior and system usage. It identifies patterns such as peak hours and days for drink-driving attempts and frequency of system interaction. These insights help administrators understand behavioral trends and support the development of improved safety protocols and preventive strategies.   
**Emergency Assistance Module:**   
The Emergency Assistance Module provides riders with immediate access to support features through the system interface. It includes an “Emergency Contact” function that allows the rider to notify designated individuals in cases of failed verification or hardware issues. The module also enables automated location sharing and offers access to ride-hailing services, ensuring that riders have a safe alternative when they are unable to operate the motorcycle.   
**Dashboard Module:**   
The Dashboard Module provides a real-time monitoring interface for both riders and administrators. Riders can view the current status of the motorcycle, including ignition state, active alerts, and recent test results. Administrators, on the other hand, can access visual summaries such as graphs and charts to monitor multiple riders, track system activity, and manage alerts efficiently. 

**Data Logging Module:**   
The Data Logging Module is responsible for continuously recording and storing all relevant system data, including the rider’s Breath Alcohol Concentration (BrAC) levels, identity verification results, and sensor readings for each attempt. It ensures that all data is securely stored for future review and reporting. The module also includes a local data caching feature that temporarily stores information when the system is offline. Once a stable internet or cellular connection is restored, the system automatically synchronizes the stored data with the web-based administrator dashboard.   
**Backup and Restore Module:**   
The Backup and Restore Module ensure data integrity and system reliability by allowing administrators to create and manage backups of the entire database, including facial recognition logs. It enables system rollback to a previous state in case of technical issues and supports accuracy verification during recovery processes. The system also performs periodic and automated backups of all critical data to secure storage, ensuring that rider information and system logs are preserved even in the event of system failure.   
***Delimitation***   
The system is limited to breath alcohol detection using the MQ-3 sensor and does not incorporate other forms of intoxication detection such as blood or saliva analysis. Emergency Contact alert functionality is restricted only to registered 

emergency contacts and is not accessible to the general public. Sending GPS locations, emergency alerts, and companion authentication requests depends entirely on having a strong internet or cellular signal. The identity verification process relies solely on facial recognition technology, which may not perform reliably under extreme environmental conditions. The system is designed to operate under normal riding conditions and may be affected by factors such as harsh weather, strong winds, or exposure to external substances like perfumes, sanitizers, or fuel vapors, which can influence sensor readings. Additionally, the system cannot guarantee the prevention of all road accidents, as it functions only as a preventive assistance tool. It does not account for all external variables that may affect riding safety, including environmental interference or improper use of the device.   
**Theoretical Framework**  
**Technology Acceptance Model**  
The intellectual foundation of this study is primarily anchored on the Technology Acceptance Model (TAM) developed by Fred Davis (1989). This theoretical model explains how individuals come to accept and adopt new technology, positing that Perceived Ease of Use and Perceived Usefulness are the two primary determinants of behavioral intention. In the context of the proposed web-based alcohol detection system, this theory establishes that motorcycle riders and local authorities will only integrate this safety intervention into their daily routines if the physical hardware interaction is seamless and the web dashboard provides genuine and measurable benefits for emergency response.    
**General Deterrence Theory**  
Furthermore, the study draws upon the General Deterrence Theory proposed by Gibbs (1975), which suggests that certainty, severity, and celerity of consequences directly deter unwanted human behavior. By integrating a computer vision-validated ignition lock, the system creates an immediate and unavoidable physical barrier against alcohol-impaired driving. This theoretical lens explains why shifting from delayed legal punishments to instant vehicular lockouts can fundamentally alter driver behavior and reduce the likelihood of driving under the influence.   
**Internet of Vehicles (IoV) Paradigm**  
	Lastly, the study is grounded on the Internet of Vehicles (IoV) paradigm, which explains how isolated vehicles can be transformed into interconnected smart nodes through IoT technologies, sensors, and GPS modules. According to Visconti et al. (2025), interconnected vehicular systems enable real-time data sharing and proactive road safety monitoring. In the proposed MotoLock system, the integration of IoT gas sensors, GPS tracking, and web-based monitoring supports a community-oriented safety network that enhances emergency response and preventive road safety measures.  
**Conceptual Framework**   
The research model follows a structured Input-Process-Output-Feedback mechanism to clearly illustrate the functional flow of the proposed safety system.    
The Input phase consists of the raw data and physical variables required for the system to initiate. These inputs include the rider's breath sample, the live facial features captured by the camera module, the motorcycle’s default locked state, and the pre-registered database of user profiles and emergency contacts.    
The Process phase represents the main operations performed by the system using its integrated hardware and software components. At this stage, the motorcycle remains in a locked state while the system initiates a continuous verification sequence through the camera module. First, the rider must show the registered MotoLock helmet with the chin bar down to activate the IR sensor and scan the logo. Second, the rider lifts the chin bar for facial recognition and liveness detection. Once the rider is successfully verified, the rider must pull the chin bar down again to secure the helmet within the camera frame, re-triggering the IR sensor. After identity and hardware are secured, the system proceeds with alcohol detection using the MQ-3 sensor, where the rider provides a breath sample for analysis. The microcontroller then processes the collected data by comparing the detected alcohol level with the set threshold while also managing system logic such as attempt limits, cooldown periods, and lockout conditions. At the same time, the relay controls the ignition state of the motorcycle, while the rider's connected smartphone handles GPS location tracking and internet communication for alerts. All processed data is synchronized with the web-based dashboard for monitoring and logging.    
The Output phase shows the final actions of the system. Based on the results, the ignition relay either allows the motorcycle to start or keeps it locked. If alcohol is detected or verification fails, the system prevents ignition and sends alerts, including the rider’s location and status, to registered emergency contacts. It also records system activity, such as lockouts and timestamps, in the web-based dashboard.    
Finally, a Feedback loop integrates the human evaluation element back into the development cycle. System performance, sensor accuracy, and overall user experience are continuously evaluated by riders and administrators using the ISO/IEC 25010:2023 software quality characteristics and the Technology Acceptance Model. This continuous flow of evaluation data ensures that hardware calibration and software interfaces are systematically refined to meet user needs and safety standards. 

![][image1]  
***Figure 1.1 IPOF Model***

**Hypothesis of the Study **   
**H0:** The MotoLock: An IoT-Based Alcohol Detection and Safe-Ride System does not have a significant effect on user acceptance, system quality, and efficiency of motorcycle safety and record management.   
**H1:** The MotoLock: An IoT-Based Alcohol Detection and Safe-Ride System has a significant effect on user acceptance, system quality, and efficiency of motorcycle safety and record management.   
   
 

   
 

**CHAPTER 2**  
**SYSTEM DEVELOPMENT**

**System Development Methodology**   
This study utilizes the Iterative System Development Life Cycle (SDLC) model as the primary framework in developing the MotoLock: An IoT-Based Alcohol Detection and Safe-Ride System. The Iterative model is a cyclical approach where the project is broken into small, manageable iterations or cycles, with each iteration producing a working version of the software that is incrementally improved until the final product meets all requirements (Talreja, 2025). Unlike traditional linear models, the iterative approach allows the researcher to focus on building, testing, and refining the system repeatedly, making it ideal for projects where early user feedback is valuable, and requirements may evolve.   
The Iterative model was selected for this study because it enables flexibility, risk reduction, and continuous improvement through repeated cycles of development and testing. This is particularly important for MotoLock, which involves the complex integration of hardware sensors and mobile connectivity. By using an iterative approach, the researchers can identify technical issues or sensor calibration errors early in the development process rather than at the end. Moreover, the model supports frequent testing and refinement, which is essential when integrating IoT components to ensure system reliability, safety, and accurate real-time notifications (Ismail & Dawoud, 2022).  
![][image2]  
***Figure 2.1 Iterative System Development Life Cycle***

The system development process follows several iterative phases. In the Requirement Planning Phase, the researcher gathers and analyzes data on motorcycle safety risks, identifies both functional requirements (alcohol detection, engine locking) and non-functional requirements (sensor accuracy, response time), and collaborates with stakeholders to prioritize system features.  
In the **System Design Phase**, the researchers designed the overall architecture of the MotoLock system, including both the hardware and software components. The team created circuit diagrams for the ESP32 microcontroller, MQ-3 alcohol sensor, GPS module, relay module, and other integrated components to ensure proper connectivity and functionality.

The researchers also designed the user interface for the web dashboard and mobile notification system to provide real-time monitoring and emergency alerts for riders and their designated companions. In addition, the team planned how the IoT technologies would communicate with each other to ensure accurate alcohol detection, identity verification, GPS tracking, and real-time data transmission. To improve the reliability of the system, the researchers carefully considered the motorcycle’s open-air environment and planned protective measures for the hardware components against environmental factors such as wind, vibration, and weather conditions. The finalized system design served as the foundation for the development and implementation phases of the study.  
In the **Development Phase**, all system modules were implemented through incremental coding and hardware assembly. These included sensor data processing, identity verification using liveness detection, ignition control, and emergency contact alert triggers. The researcher integrated the MQ-3 alcohol sensor, ESP32 microcontroller, GPS module, relay system, and camera-based verification to ensure proper system functionality. Each component was carefully developed and connected to ensure seamless communication between hardware and software modules. After integrating all inputs, the system was continuously refined to ensure stability and real-time performance.  
In the **Testing Phase**, continuous testing was conducted, including unit testing of individual sensors and integration testing of IoT modules. The researcher identified and resolved system errors to ensure performance, security, and reliability. Special attention was given to validating the accuracy of alcohol detection and ensuring that identity verification and alcohol sensing functioned correctly in real-time under different conditions.  
In the **Deployment Phase**, the system was implemented in a controlled environment where users were allowed to interact with the MotoLock device. The researcher observed and monitored system performance, connectivity, and hardware stability during actual usage simulations to ensure proper functioning.  
Finally, in the **Evaluation and Feedback Phase**, the researcher gathered feedback from motorcycle riders and safety experts using the Technology Acceptance Model (TAM) developed by Fred Davis (1989), focusing on Perceived Ease of Use and Perceived Usefulness. The researcher also evaluated the system based on ISO/IEC 25010:2023 software quality standards in terms of functional stability, reliability, compatibility, performance efficiency, capability, flexibility, safety, maintainability, and security. The collected results were used to refine and improve the system for further enhancement of usability, efficiency, and overall performance.  
**Requirements Analysis**   
This section presents the requirement specifications and analysis for the proposed MotoLock system, an IoT-based motorcycle safety mechanism designed to prevent intoxicated driving through integrated alcohol detection and identity verification. The requirements were derived from data gathered through interviews, document analysis, and stakeholder evaluation. The purpose of this phase is to clearly define the system’s expected functions and operational conditions, ensuring that the developed solution effectively addresses real-world road safety issues and user needs.    
The **functional requirements** define the specific features and operations that the system must perform. The MotoLock system must maintain a default locked state, requiring the rider to complete a multi-step physical and biometric verification before the engine can be activated. First, the smartphone's front camera captures the rider's facial data to perform computer vision-based identity validation (Face ID). To accommodate modular helmets and ensure clear facial visibility, the system allows the rider to lift the helmet's chin bar during this phase. Although lifting the chin bar disengages the infrared (IR) wear sensor (IR=0), the system continues verification by requiring the camera to simultaneously detect the unique MotoLock Helmet Logo located on the helmet's forehead. The AI strictly enforces "Spatial Association" by verifying that the helmet logo's bounding box naturally overlaps and aligns with the rider's face bounding box, mathematically preventing a "Sober Proxy" bypass where a friend stands off-camera holding the helmet. Once the Face ID and Logo are verified, the application authorizes the unlocking process; however, the ignition remains physically locked. The workflow natively guides the rider to the final step: lowering the chin bar to take the breath test. Lowering the chin bar re-engages the IR sensor (IR=1) against the rider's chin and positions the battery-powered Helmet ESP32's MQ-3 gas sensor directly in front of the mouth to capture and analyze the breath sample. 

The Motor ESP32 microcontroller processes these inputs via Bluetooth Low Energy (BLE) and controls the ignition relay. The system operates as a "Start Interlock", meaning it prevents the engine from starting if alcohol is detected, but for safety reasons, it will never kill the engine mid-ride. If alcohol is detected while driving, or if the helmet is intentionally turned off (Tamper Event), the Android application will automatically send SMS notifications (using the phone's native SMS API) with location data to pre-registered emergency contacts. The system also features a 5-minute hardware-based grace period where the helmet retains authorization, allowing the rider to restart the engine in traffic without requiring Face ID again. Furthermore, all system activities including test results, timestamps, user identification, and GPS coordinates must be transmitted to a centralized web-based dashboard for monitoring and record-keeping.

The **non-functional requirements** describe the quality attributes and constraints under which the system operates. In terms of performance, the entire validation process from breath input to final system decision must be completed within a few seconds to ensure user convenience. Reliability is critical, as the system must maintain accurate sensor readings and facial recognition performance in open-air environments, accounting for factors such as wind interference and varying lighting conditions. Security requirements include the implementation of secure authentication mechanisms for the web dashboard, such as password protection and session management, as well as physical protection of hardware components to prevent tampering or bypassing of the ignition system. Usability is also a key consideration; the system interface must provide clear visual indicators to guide the rider through each step, including sensor readiness, breath input prompts, and final ignition status.    
The requirement analysis process involved synthesizing data to identify the core needs of the system’s primary stakeholders. Motorcycle riders require a fast, seamless, and intuitive verification process that does not significantly delay their travel; therefore, the system must be highly responsive and easy to use. Emergency contacts and relevant authorities require immediate and reliable access to critical information, which necessitates automated transmission of accurate geolocation data and system status without relying on rider input. Additionally, the system requires a stable and efficient power source from the motorcycle’s battery to support continuous operation of IoT components without causing excessive power drain when the vehicle is idle.   
To ensure a comprehensive understanding of real-world challenges, a triangulated approach to data gathering was employed. Interviews were conducted with representatives from the Land Transportation Office (LTO), engineers, and motorcycle riders. The LTO provided insights into traffic regulations and enforcement challenges related to drunk driving. Engineers contributed technical expertise in selecting appropriate hardware components and system architecture. Motorcycle riders shared their experiences, riding conditions, and interaction with technology, which helped identify usability concerns, optimal hardware placement, and acceptance of features such as facial recognition, alcohol detection, and automated alerts. In addition, document analysis was performed by reviewing existing road safety studies and national traffic laws, particularly the Anti-Drunk and Drugged Driving Act, to establish the appropriate Breath Alcohol Concentration (BrAC) threshold that triggers engine lockout.   
Overall, this phase ensures that all system requirements are clearly defined, validated, and aligned with the objectives of the study, serving as the foundation for the system design and development of a reliable, secure, and user-centered IoT-Based Alcohol Detection and Companion-Assisted Safe-Ride System.  
**Existing System**  
The existing approach to road safety and drunk driving prevention mainly depends on manual and reactive measures, such as police-operated checkpoints and traditional mechanical ignition locks. In this setup, traffic authorities are required to physically stop vehicles and inspect drivers for possible signs of intoxication, often relying on subjective observations such as the smell of alcohol, slurred speech, or visible physical instability. These methods are considered inefficient because checkpoints cannot continuously monitor every motorcycle rider, while conventional ignition locks can easily be bypassed or disregarded. In addition, current systems do not provide a reliable method to verify whether the individual taking the breath test is the actual rider of the motorcycle, creating opportunities for “sober proxies” to operate the system on behalf of intoxicated individuals.  
Typically, the process begins once the rider starts traveling, with no active technological intervention unless a random checkpoint is encountered. During checkpoint operations, officers utilize handheld breathalyzers to assess alcohol intoxication; however, the results are commonly recorded manually, increasing the risk of inconsistent documentation, delayed reporting, or data loss. Although some modern motorcycle security systems incorporate short-range Bluetooth locking mechanisms, these technologies are limited in functionality because they lack integrated GPS tracking, automated emergency notifications, and long-distance communication features. As a result, emergency contacts or family members are unable to receive immediate alerts or real-time location updates during critical situations. This lack of system integration highlights a significant gap in proactive road safety, emergency response, and real-time monitoring for motorcycle riders.

d  
***Figure 2.2 Existing System for the Admin***  
The administrator experienced several limitations in the existing motorcycle safety and drunk driving prevention systems, as shown in Figure 2.2, due to the reliance on disconnected tools, manual processes, and isolated monitoring methods. In the current setup, administrators commonly used spreadsheets, local files, handheld devices, messaging applications, and manually generated reports to manage rider information and monitor incidents. Rider accounts and profiles were manually encoded and updated, while alcohol test results, violations, and incident reports were recorded separately using paper-based or standalone systems, increasing the risk of incomplete records, data inconsistency, and delayed information retrieval.  
Additionally, administrators were required to collect data from different devices, applications, and reports separately because most existing systems were not integrated into a centralized platform. Communication and emergency coordination were commonly handled through SMS, phone calls, or messaging applications, which limited the efficiency of notification workflows and delayed response during critical situations. Weekly and monthly reports were also generated manually, consuming significant time and effort while increasing the possibility of human error.  
The existing system further relied on local storage devices or external drives for backup management, making long-term data preservation less secure and more vulnerable to data loss or corruption. Because of the absence of integrated analytics and centralized monitoring tools, administrators had limited access to real-time insights and data-driven decision-making for identifying risky rider behavior and monitoring alcohol-related incidents. These limitations highlighted the need for a more integrated, automated, and intelligent motorcycle safety management system.

***Figure 2.3 Existing System for the Rider***  
The rider experienced several limitations in the existing road safety and drunk driving prevention system, as shown in Figure 2.3, due to the absence of automated and proactive safety mechanisms. In the current setup, motorcycle riders could operate their vehicles freely unless they encountered random police checkpoints during travel. Alcohol testing was only conducted manually through handheld breathalyzers during apprehension, meaning intoxicated riders could still operate motorcycles without immediate detection. Additionally, the system relied heavily on officer observation and physical indicators of intoxication, such as unstable movement or the smell of alcohol, which may lead to inconsistent assessments and inaccurate judgment.  
The existing system also lacked identity verification mechanisms to confirm whether the person operating the motorcycle was the registered owner or the individual who underwent the alcohol test. Furthermore, there were no integrated GPS tracking features, automated emergency alerts, or centralized ride records for monitoring rider activities and incidents. In emergency situations, riders were required to manually contact companions or family members through calls or SMS, resulting in delayed assistance and limited emergency response. These limitations demonstrated the lack of real-time monitoring, automation, and preventive intervention in the traditional road safety approach.  
***Figure 2.4 Existing System for the Companion***  
The companion experienced limited involvement in the existing motorcycle safety and drunk driving prevention system, as shown in Figure 2.4, because communication and emergency coordination relied primarily on manual processes. In the current setup, companions only received information through direct calls or SMS messages initiated by the rider or traffic authorities during emergency situations. Since there were no automated alert systems, companions were unable to receive real-time notifications regarding the rider’s condition, location, or alcohol intoxication status.  
Additionally, the existing system did not provide GPS-based location tracking or remote monitoring capabilities, making it difficult for companions to immediately identify the rider’s whereabouts during critical incidents. Companions also had no authority or system access to remotely approve, deny, or intervene in motorcycle ignition operations. The absence of authentication mechanisms and centralized monitoring further limited the companion’s ability to verify emergency requests and provide timely assistance. As a result, emergency response heavily depended on delayed manual communication, highlighting the lack of integration and proactive support within the traditional system.  
**Proposed System**  
The proposed system, MotoLock, is a hybrid IoT-based alcohol detection and companion-assisted safe-ride system designed to shift road safety from reactive "catch-and-fine" methods to automated, preventative interventions. The system integrates a mobile application for riders and a web-based dashboard for administrators, creating a unified platform that centralizes sobriety logs, identity verification, and emergency alerts. Utilizing a "Smartphone-Tethered IoT" architecture, it employs an ESP32 microcontroller linked to a helmet-integrated MQ-3 sensor, while fully leveraging the rider's smartphone for offline processing, GPS tracking, and telecommunications. This approach optimizes overall system performance and power efficiency by offloading resource-intensive tasks to the mobile device's superior computing hardware, ensuring seamless and highly responsive operations. A key feature of the proposed system is the integration of continuous Face ID and Helmet Logo verification to prove the physical presence of the registered rider using localized AI (TensorFlow Lite), which functions entirely offline. Before the engine can be ignited, the system requires a legitimate breath sample and facial validation; if the rider exceeds the legal alcohol limit, a physical relay automatically disables the ignition. To enhance safety, the smartphone application automatically dispatches geofenced SMS alerts containing the rider's precise GPS location and intoxication status to designated companions. Crucially, the system uses the native Android `SmsManager` API and the smartphone's built-in GNSS chip, allowing it to send offline SMS alerts via standard cellular networks even when mobile data or internet is completely unavailable.
Overall, MotoLock addresses the limitations of manual monitoring by providing a secure database for storage efficiency and an administrative dashboard for real-time visual summaries and predictive analytics. The system ensures data integrity through a local data cache for offline logging and automatic synchronization to the cloud once a signal is restored. This proactive intervention aligns with SDG Target 3.6 by reducing the risks of road accidents through automated monitoring, maintainability, and high-precision security protocols.

***Figure 2.5 Proposed System for the Admin***  
The administrator benefited significantly from the project, as shown in Figure 2.5, by simplifying the oversight of platform operations and rider safety management. This new system provided a centralized control panel, allowing the administrator to easily configure system settings and manage rider accounts including creating or updating profiles, setting access levels, and applying administrative overrides. For system reliability, executing full database backups, which include face-recognition logs, and restoring the system to a previous state to validate recovery accuracy were seamlessly integrated. Additionally, managing massive data influxes became more efficient through the supervision of offline data syncing to the web dashboard, ensuring that all BrAC levels, identity results, and sensor readings were accurately captured. The system also included robust monitoring capabilities via a real-time dashboard to track rider activity, oversee emergency alert workflows, and analyze trends such as drink-driving attempts and peak times. Finally, it provided the option to review detailed audit logs and generate weekly or monthly compliance reports exported in PDF or Excel formats.  
![A diagram of a motorcycleAI-generated content may be incorrect.][image3]  
***Figure 2.6 Proposed System for the Rider***  
Figure 2.6 presents the proposed system for the rider, showing how MotoLock provides a secure and convenient platform for managing motorcycle access and rider safety. The system allows the rider to create an account, register Face ID, link a hardware ID, add motorcycle information, and save trusted emergency contacts. For daily use, the rider can securely access the mobile application using verified login credentials.  
To ensure safety, the system uses a seamless continuous-verification process. First, the rider presents the registered helmet with the chin bar closed to activate the IR sensor and scan the MotoLock logo. Second, the rider lifts the chin bar to undergo facial recognition. Finally, the rider pulls the chin bar down to re-engage the IR sensor, locking in the physical identity and hardware association without the helmet leaving the camera frame. Following this sequence, a pre-ride alcohol test is conducted using the helmet-based MQ-3 sensor. Motorcycle ignition is permitted only after both identity tracking and sobriety verification are successfully completed. If facial recognition fails twice, the rider may continue the verification process using a secure PIN.  
In cases of verified hardware or system malfunction, the system allows a controlled manual override to temporarily restore ignition functionality while maintaining system logging and security protocols. However, manual override remains disabled during alcohol-positive cases to preserve the preventive and safety-focused purpose of the system.  
The system also provides dashboard monitoring where the rider can view current device status and recent ride history. In emergency situations, the rider can notify emergency contacts, share live location information, or access ride-hailing assistance.

***Figure 2.7 Proposed System for the Emergency Contact***  
The emergency contact benefited significantly from the proposed MotoLock system by receiving timely notifications and essential information during emergency situations. As shown in Figure 2.7, the system automatically sends SMS alerts containing the rider’s GPS location, intoxication status, and other emergency details whenever a failed sobriety test or safety-related incident occurs.  
The emergency contact can access the rider’s real-time location through the provided GPS link and review important alert information, including the rider’s sobriety verification results and current status. The system also allows the emergency contact to communicate directly with the rider to verify the situation and provide immediate assistance when necessary.  
Furthermore, the emergency contact may take appropriate actions, such as assisting the rider, arranging transportation, contacting local authorities, or seeking medical assistance during emergencies. The system also provides follow-up notifications regarding status updates and emergency escalations to keep the emergency contact informed throughout the incident.  
To ensure privacy and security, all information shared through the system is used solely for rider safety and emergency response purposes. Emergency contact information is protected and handled securely to prevent unauthorized access.  
**System Design**  
**Logical Specifications**   
**Data Flow Diagram**  
The Data Flow Diagram (DFD) provides a clear visualization of the inputs and outputs of each entity and the internal logic of the MotoLock system. DFDs are organized into levels, where the high-level processes identified in the context diagram are decomposed into detailed sub-processes at lower levels.  
The diagrams utilize four fundamental elements: processes (rounded rectangles) representing data manipulation; data stores (open rectangles) representing repositories where information is kept; external entities (rectangles) representing the sources and destinations of data outside the system boundary; and data flows (arrows) illustrating the movement of information between these elements.  
A data flow diagram (DFD) is a visual aid that shows how steps, external entities, and information flow through a system or process.  
A Context Diagram (Level 0 DFD) serves as the highest-level overview, illustrating the system's boundaries and its interactions with external entities.  
The diagram in Figure 2.1 shows the functionality of the system. The Level 0 diagram shows the three external entities that interact with the system. The Rider, upon attempting to operate the vehicle, provides breath samples for alcohol detection and facial data for identity verification. In return, the rider receives visual and audio feedback regarding the ignition status and verification results. The Companion, as a registered emergency contact, receives automated SMS notifications containing the rider's status and real-time GPS location data when an intoxication event is detected. The Admin interacts with the system by managing user records and monitoring system activities through a centralized dashboard, receiving logs of all safety tests and system alerts.  
      

***Figure 2.8 Proposed System Context Diagram***  
Figure 2.8 illustrates the overall interaction and data flow between the MotoLock IoT Safety System and its external entities, including the rider, companion or emergency contact, administrator, and IoT hardware and sensors installed in the motorcycle or helmet. The rider interacts with the system by providing authentication credentials and liveness verification inputs such as facial recognition. In return, the system provides identity verification results, alerts, ride assistance request like ride-hailing apps, and motorcycle status updates such as armed, locked, or unlocked conditions.  
The IoT hardware and sensors communicate directly with the MotoLock system by sending BrAC readings, GPS location, and hardware status information including ignition, relay, and battery conditions. In response, the system transmits relay control commands, system configurations, and firmware updates to the hardware components to manage motorcycle ignition and safety operations.  
During emergency situations or failed alcohol tests, the system automatically sends high alcohol alerts containing the rider’s exact BrAC level, GPS location, and emergency SMS notifications to the emergency contact. The emergency contacts are receiving alerts, GPS location data, and emergency notifications only.  
On the administrative side, the administrator interacts with the system to configure settings, manage rider accounts, and request reports. The system then provides dashboard data, logs, alerts, hardware status reports, and sobriety test summaries for monitoring and decision-making purposes. Overall, the context diagram presents the MotoLock system as a centralized IoT-based motorcycle safety platform that integrates authentication, alcohol detection, emergency response, and real-time monitoring functionalities.

**![][image4]**                      
***Figure 2.9 Proposed System Level 0 Diagram***  
Diagram in Figure 2.9 illustrates the Level 0 Data Flow Diagram (Context Diagram) of the proposed MotoLock system. The diagram presents the overall interaction between the MotoLock: IoT-Based Alcohol Detection and Safe-Ride System and its three major external entities, namely the Rider, Emergency Contact, and Administrator through the Web Dashboard.  
The Rider interacts with the system by providing registration information, login credentials, facial verification data, breath sample inputs for alcohol testing, emergency contact information, and ride assistance requests. In return, the system provides verification results, alcohol test results, ignition lock status, alert notifications, and acknowledgment messages to the rider.  
The Emergency Contact receives important notifications from the system, including rider information, GPS location, intoxication level, secure authentication links, and emergency alert notifications whenever a violation or emergency situation is detected.   
The Administrator accesses the MotoLock system through the web-based dashboard to monitor and manage overall system operations. The system sends rider information, alcohol detection data, GPS location data, system logs, alert logs, and device status information to the Administrator. In return, the Administrator can provide configuration settings, user management controls, report generation requests, system commands, and acknowledgment responses to maintain and supervise the system effectively.  
Overall, the Level 0 DFD demonstrates how MotoLock integrates alcohol detection, facial verification, GPS tracking, emergency notification, and web-based monitoring into a centralized IoT safety system designed to prevent intoxicated motorcycle operation and improve emergency response capabilities.  
***![A screenshot of a computerAI-generated content may be incorrect.][image5]***  
***Figure 2.10 Proposed System Level 1 Diagram***  
Figure 2.10 illustrates the overall data flow of the proposed MotoLock system, showing how data moves between external entities, system processes, and database storage. The process begins with the rider entering login credentials, registration details, hardware ID, and emergency contact information through the User Authentication & Device Linking process. The system then verifies and stores rider profiles, linked hardware devices, and emergency contact records in the corresponding databases while returning an authorized session status and authentication token to the rider.  
After successful authentication, the rider proceeds to the Identity Verification, where facial data are analyzed to verify the rider’s identity. The verification result is stored in the identity verification logs and passed to the Alcohol Detection & Ignition Control process. In this stage, the rider provides a breath sample which is analyzed to determine the rider’s BrAC level. Depending on the result, the system either enables or disables the motorcycle ignition while storing the sobriety test results in the database. The motorcycle ignition may also receive an emergency bypass signal from the manual override switch during hardware and system malfunction or emergency situations.  
If the rider fails the alcohol test, the system forwards the failed test data to the Emergency Contact Notification, which sends SMS alerts containing the rider’s GPS location and BrAC level to the registered emergency contact.   
Lastly, the Monitoring, Reports & Data Management process enables the administrator to manage system settings, user and device information, dashboard data, logs, reports, and analytics. The system also generates riding session reports and stores them in the system reports database for monitoring and reporting purposes.  
***![A diagram of a software security systemAI-generated content may be incorrect.][image6]***  
***Figure 2.11 Proposed System Level 2 Diagram*** ***for Process 1.0 – User Authentication & Device Linking***  
Figure 2.11 illustrates the detailed data flow for Process 1.0, User Authentication & Device Linking. The process begins when the rider enters login credentials, registration details, hardware ID, and emergency contact information into the system. The system validates the rider account by checking the rider profile stored in the riders database. After successful validation, the system maps and links the rider’s hardware ID to the registered account and stores the information in the hardware devices database. Emergency contact details are also saved and updated in the emergency contacts database. Finally, the system generates an authentication token and authorized session status, allowing the rider to securely access the MotoLock system.

***Figure 2.12 Proposed System Level 2 Diagram*** ***for Process 2.0 – Identity Verification***  
Figure 2.12 illustrates the detailed process of identity verification within the proposed system. The process begins when the rider provides facial data through the mobile application. The system captures the rider’s facial image, detects and extracts facial features, to confirm that the rider is a real person rather than a spoofed image or video. After verification, the system validates the rider’s identity and stores the verification result in the identity verification logs database. The result, whether pass or fail, is then forwarded to the next process for alcohol detection and ignition control.

***Figure 2.13 Proposed System Level 3 Diagram*** ***for Process 3.0 – Alcohol Detection & Ignition Control***  
Figure 2.13 illustrates the detailed process of alcohol detection and ignition control in the proposed MotoLock system. The process begins when the rider provides a breath sample through the MQ-3 alcohol sensor. The system acquires the breath sample, processes the sensor readings, and calculates the rider’s BrAC level. The calculated value is then evaluated against the defined alcohol threshold to determine whether the rider passes or fails the sobriety test. Test results, including BrAC level, time, and status, are stored in the sobriety test logs database.  
If the rider’s BrAC level is within the acceptable limit, the system enables the motorcycle ignition through the relay or ECU. However, if the BrAC level exceeds the threshold, the system disables the ignition or places the motorcycle in lockout mode. During emergency situations or hardware malfunction, the manual override switch may send an emergency bypass signal directly to the motorcycle ignition system. In addition, failed test data containing the rider’s GPS location, BrAC level, and timestamp are forwarded to the emergency contact notification. The system also supports a manual override feature that allows the rider to bypass ignition lock restrictions during emergency situations or hardware and system malfunction. Override activities are monitored and recorded within the system logs for security purposes.  
![A screenshot of a phoneAI-generated content may be incorrect.][image7]  
***Figure 2.14 Proposed System Level 3 Diagram for Process 4.0 –Emergency Contact Notification***  
Figure 2.14 illustrates the detailed process of emergency contacts notification in the proposed system. When a rider fails the alcohol detection process, failed test data containing the rider’s GPS location, BrAC level, and timestamp are received by the system. The system then sends an SMS alert to the emergency contact to notify them about the rider’s condition and location. All alerts and responses are recorded and stored in the alert logs database for monitoring and documentation purposes.

***Figure 2.15 Proposed System Level 3 Diagram for Process 5.0 – Monitoring, Reports & Data Management***

Figure 2.15 illustrates the detailed process of monitoring, reports, and data management within the proposed MotoLock system. The administrator interacts with the system by managing settings, user and device information, and report requests. The system supports user and device management by storing and updating rider profiles, hardware devices, and emergency contact information in the corresponding databases. It also manages real-time dashboard monitoring, allowing administrators to access system status, logs, and riding session data.

Furthermore, the system generates reports and analytics based on stored logs and riding session records. Alert logs and analytics are stored in the alert logs database, while generated reports and riding session reports are saved in the system reports database. These features improve monitoring efficiency, reporting accuracy, and overall decision-making for motorcycle safety management.

**Physical Specifications**  
The Physical Specifications of the MotoLock system is organized into a hierarchical structure that outlines the specific functions, content, and interconnections required to ensure motorcycle safety and driver accountability. At the highest level of this architecture is the unified system, which integrates the mobile application for riders and the web-based administrative dashboard. The User Management and Authentication Module serve as the initial tier, where users log in with verified credentials. This module redirects users to their designated interfaces, loading relevant modules based on their roles as riders or administrators. Within this tier, the system also manages hardware-to-account linking and emergency contact registration.   
The Identity Validation Module is a critical tier that requires riders to prove physical presence through face verifications. This module utilizes local mobile processing to ensure functionality even without an active internet connection. Once identity is confirmed, the system executes an encrypted Bluetooth handshake to authorize the ignition sequence. Complementing this is the Alcohol Detection Module, which performs real-time Breath Alcohol Concentration (BrAC) analysis via the MQ-3 sensor. If the legal limit is exceeded, the Engine Lock Control Module triggers a physical relay to disable the ignition.   
The Emergency Contact Notification and Alert Module facilitate the automated transmission of geofenced SMS alerts containing the rider's GPS location and intoxication levels to registered contacts. It also includes an Emergency Assistance Module that provides riders with one-button access to notify linked individuals or access ride-hailing services like Grab or JoyRide when they are unable to operate the vehicle.   
For administrative oversight, the Dashboard Module provides real-time visual summaries, status monitors, and active alert notifications. The Reports Module and Data Logging Module streamline the process of managing and accessing system activity, allowing administrators to export comprehensive weekly or monthly compliance reports in PDF or Excel formats. Furthermore, the Predictive Analytics Module identifies risky behavior patterns, such as peak hours for drink-driving attempts, to improve future safety protocols. Finally, the Backup and Restore Module ensure system reliability by performing periodic snapshots of all critical activity and biometrics to prevent data loss during technical failures.   
***![A diagram of a safety systemAI-generated content may be incorrect.][image8]***  
***Figure 2.16 Visual Table of Contents of Process 1.1 to 1.6***

Figure 2.16 illustrates the hierarchy of processes within the User Management and Authentication Module, Identity Validation Module, Helmet-Based Hardware Module, Engine Lock Module, Emergency Contact Notification and Emergency Module, Dashboard and Administrative Module, and Data Maintenance and Security Module.

The Helmet-Based Hardware Module includes the MQ-3 alcohol sensor and IR sensor installed inside the rider’s helmet. The IR sensor detects whether the rider is properly wearing the helmet before allowing the MQ-3 sensor to activate for alcohol detection. If the rider is not detected, the OLED screen displays a “Rider Not Detected” message, and the alcohol detection process remains inactive.

The Engine Lock Module manages ignition relay activation, engine lock control, manual override, emergency bypass mechanisms, and fail-safe lockout protocols to prevent unsafe motorcycle operation. The Emergency Contact Notification and Emergency Module facilitates automated SMS alerts containing the rider’s GPS location and BrAC information for registered emergency contacts. It also supports ride-hailing assistance during emergency situations.

Furthermore, the Dashboard and Administrative Module presents real-time monitoring, rider behavior analytics, and compliance report generation in PDF or Excel format. The Data Maintenance and Security Module ensures continuous logging of sobriety and identity verification records, local data caching for offline functionality, and automated backup of activity logs to maintain data integrity and system reliability.

**User Interface Design**

**![][image9]**  
***Figure 2.17 Login Page***  
This figure serves as the login interface of the MotoLock system, where users are required to enter their credentials to access the system. It features a simple and minimalistic design consisting of a username field, a password field with visibility toggle, and a login button for authentication. 

![][image10]  
***Figure 2.18 Create Account***  
This figure serves as the registration interface of the MotoLock system, where users are required to provide their personal information to create an account and access the system features. It features a clean and organized design consisting of input fields for full name, email address, mobile number, password, and password confirmation.

![][image11]  
***Figure 2.19 Face ID Registration***  
This figure presents the initial Face ID setup interface of the MotoLock system, where the rider is guided before starting biometric enrollment. This page informs the user that their registered Face ID will be used for identity verification before unlocking the motorcycle. It provides clear preparation instructions, such as finding a well-lit area, removing face masks and glasses, looking directly at the camera, and ensuring that the face is fully visible. These guidelines help improve the accuracy of the facial recognition process and reduce possible verification errors during registration.

![][image12]  
***Figure 2.20 Face ID Registration 1***  
This figure shows the Face ID Capture page of the MotoLock system, where the rider is required to position their face properly within the camera frame for biometric registration. This interface instructs the user to keep their face centered while the system automatically detects and captures the facial image. The circular frame and face guide help ensure that the rider’s face is clearly aligned for accurate recognition. The progress indicator displays the capture status, showing when the face has been successfully detected and recorded. This step allows the system to store the rider’s facial data, which will later be used for identity verification before unlocking the motorcycle.

![][image13]  
***Figure 2.21 Face ID Registration 2***  
This figure shows the Face Angle Detection page of the MotoLock system, where the rider is instructed to slowly turn their head during Face ID registration. This step allows the system to capture the rider’s face from different angles, improving the accuracy and reliability of the biometric verification process. The circular camera frame and face guide help the user maintain proper positioning while the system detects the required face angle. Once the angle is successfully recognized, the system automatically captures the data and shows the progress status. This process helps ensure that the registered Face ID can still identify the rider accurately during future verification attempts before motorcycle access is granted.

***![][image14]***  
***Figure 2.22 Face ID Registered***  
This figure shows the Face ID Registration Confirmation page of the MotoLock system, which appears after the rider successfully completes the facial enrollment process. The check icon indicates that the Face ID has been successfully registered and saved in the system. This page confirms that the rider can now use their registered Face ID for identity verification before unlocking the motorcycle.

![][image15]  
***Figure 2.23 Security Pin***  
This figure shows the Security Pin Page that serves as an additional security verification interface of the MotoLock system, where users are required to create a 4-digit PIN to further protect their account and sensitive information. 

![][image16]  
***Figure 2.24 Add Trusted Contact***  
This figure shows the Add Trusted Contact page of the MotoLock system, where the rider can register an emergency contact who will receive safety alerts when needed. The page includes input fields for the contact’s full name and phone number, allowing the system to store the necessary contact information for emergency notifications. It also provides contact role options, where the rider can assign the person as either a Primary Contact or Secondary Contact. The Primary Contact will be notified first during emergency alerts, while the Secondary Contact will also receive the alert after the primary contact.

![][image17]  
***Figure 2.25 Register Motorcycle***  
This figure shows the Register Motorcycle Page serves as the motorcycle registration interface of the MotoLock system, where users are required to provide their motorcycle information for ignition management and system monitoring.

![][image18]  
***Figure 2.26 Connect Device***  
This figure shows the Connect Device page of the MotoLock system, where the rider is instructed to turn on the MotoLock hardware and enable Bluetooth on the mobile device. This page allows the application to scan for nearby MotoLock devices and display available Bluetooth connections. This step ensures that the mobile application is connected to the MotoLock hardware before continuing with the remaining setup and motorcycle access features.

![][image19]  
***Figure 2.27 Select Motorcycle***  
This figure shows the page of the MotoLock system, where the rider can choose which registered motorcycle they want to unlock. The rider can tap the preferred motorcycle before proceeding to the unlocking and verification process. This feature is useful for users who have more than one registered motorcycle under their MotoLock account.

**![][image20]**  
***Figure 2.28 Face Recognition Without Helmet***  
This figure shows the No Helmet Face Verification page of the MotoLock system, where the rider is required to remove their helmet and look directly at the camera for identity verification. This page uses the previously registered Face ID to check whether the rider’s face matches the stored biometric profile. The circular camera frame helps guide the rider in positioning their face properly, while the status message indicates whether the face has been successfully matched.

![][image21]  
***Figure 2.29 Face Recognition With Helmet***  
This Figure shows the With Helmet Face Verification page of the MotoLock system, where the rider is required to wear their helmet and look directly at the camera. This step verifies both the rider’s identity and helmet presence before the motorcycle unlocking process can continue. The circular camera frame guides the rider in positioning their face and helmet properly for accurate detection.

![][image22]  
***Figure 2.27 Sobriety Test***  
This figure shows the sobriety test screen of the system. It is used to verify that the user is not under the influence of alcohol before operating the vehicle. The screen displays a breath sensor that prompts the user to blow steadily for 5 seconds. This ensures that the user is sober and fit to proceed with the journey.

**System Development**  
**Website Development**  
For the cloud server and administrative dashboard, the researchers utilized Python as the primary backend programming language for the administrative dashboard and server-side operations. Python was selected because of its flexibility, efficient backend processing capabilities, database integration support, and suitability for real-time monitoring and report generation. The system backend handles authentication, dashboard monitoring, PDF and Excel report generation, and communication between the IoT hardware and the web-based administrative dashboard.  
The front-end interface of the system was developed using HTML5, CSS3, and JavaScript. The researchers utilized the Bootstrap Framework as the primary front-end component library to ensure a fully responsive user interface across desktop and mobile devices. Additionally, the Google Maps Platform API was integrated using JavaScript to display the real-time GPS coordinates transmitted by the motorcycle during failed sobriety tests and lockout incidents. Visual Studio Code served as the primary source code editor throughout the development process.  
**Database**  
On the back-end server side of the system, the researcher used a PostgreSQL database managed through a Supabase backend environment to handle high-performance data operations. **Website Host**  
The system is hosted on a scalable cloud platform such as AWS or Vercel utilizing the Supabase backend environment to manage the live API and PostgreSQL database.  
**Hardware Development Tools**  
**Web Development**  
The proposed project requires the following hardware specifications for its development:

1. At least 2.0 GHz Dual-Core processor or better   
2. 4GB to 8GB of memory  
3. 256 GB SSD or 320 GB Hard Disk capacity   
4. 50 GB to 100 GB SSD storage   
5. Minimum 1.8 GHz Octa-core processor  
6. At least 3GB of memory  
7. Android 8.0 and above

**System Testing**  
**Verification, Validation and Testing**  
To ensure the quality, reliability, and effectiveness of the proposed MotoLock system, the researchers utilized the ISO/IEC 25010:2023 Software Quality Model as the primary framework for evaluating both the embedded hardware system and the web-based monitoring platform. The ISO/IEC 25010:2023 model, established by the International Organization for Standardization (ISO) and the International Electrotechnical Commission (IEC), provides internationally recognized standards for software quality evaluation. The researchers utilized the following ISO/IEC 25010:2023 quality characteristics to assess the proposed system:

* Functional Suitability  
* Reliability  
* Performance Efficiency  
* Interaction Capability  
* Security  
* Compatibility  
* Maintainability  
* Flexibility  
* Safety

**System Implementation**  
**Implementation Plan**  
The implementation plan detailed the strategies for utilizing, installing, and deploying the MotoLock IoT Safe-Ride System within the municipality of Bocaue, outlining the comprehensive project delivery approach. It included the introduction and training on the proposed system for its various end-users, specifically the System Administrators, registered Riders, and Designated Emergency Contacts. Below are the detailed strategies.  
***Table 1***   
***Implementation Plan***

| Strategy | Activities | Person Involved | Duration |
| :---- | :---- | :---- | :---- |
| Approval and Coordination | Submission of proposal and coordination with motorcycle riders and advisers | Researchers, Adviser, Selected Riders  | 1 week |
| Database and Set up | Encoding of rider information, emergency contacts, facial recognition data, etc.  | Researchers  | 2 days |
| Hardware Installation | Installation of MQ-3 sensor, ESP32/microcontrollers, and relay module on motorcycle and helmet  | Researchers, Selected Riders  | 1 week |
| System Development | Setup and configuration of the web-based dashboard and database server  | Researchers, Selected Riders  | 1 week |
| System Testing | Conduct of unit testing, integration testing, and system validation  | Researchers, Selected Riders  | 1 week |
| User Orientation | Demonstration on system usage and dashboard monitoring  | Researchers, Selected Riders  | 3 days |
| Implementation | Controlled testing of the MotoLock system | Researchers, Selected Riders  | 3 days |
| Monitoring and Evaluation | Gathering feedback and evaluating system performance using ISO/IEC 25010:2023 and TAM  | Researchers, Selected Riders | Continuous |

**Tools and Technologies Used**  
***Table 2***   
*Hardware and Software Requirement for Website and Mobile*

| Item | Minimum Requirement |
| :---- | :---- |
| Processor | Dual-core processor at 2.4 GHz or higher  |
| Memory (RAM) | 4 GB RAM  |
| Storage | 16 GB Hard Disk Drive or SSD  |
| Operating System  | Windows 10 or higher  |
| Development Environment  | Visual Studio Code, Arduino IDE  |
| Programming Languages  | JavaScript, HTML, CSS, C++, Kotlin |
| Frameworks  | React, Supabase, Human.js |
| Database Management System  | PostgreSQL (Supabase) |
| Version Control  | Git and GitHub  |
| Internet Connectivity  | Stable Wi-Fi or Mobile Data Connection (via Smartphone) |
| Display Module | 0.96 inch OLED SSD1306 with Case |
| Sensors | MQ-3 Alcohol Sensor, IR Obstacle Sensor |
| Relay Module  | 1-Channel 5V Relay |
| Microcontrollers  | ESP32 38-Pin, ESP32-C3 Super Mini |
| Power Supply  | Motorcycle 12V Battery with LM2596 Buck Converter, 3.7V LiPo Battery with TP4056 |
| Third-Party APIs  | Google Maps API  |
| Mobile Requirements  | Android 8.0 or higher  |

**Respondents and Sampling Technique**  
The study utilizes the Descriptive-Developmental Research Design to achieve the objective of creating a proactive motorcycle safety intervention. The descriptive component of the research is used to identify and analyze the current road safety challenges in Bocaue, Bulacan, such as the limitations of reactive police checkpoints and manual ignition locks. Through rider interviews and observations, the researchers gather the necessary technical requirements and "ease of use" standards that the system must meet.    
The developmental component focuses on the actual engineering and iterative refinement of the MotoLock system. This involves a cycle of designing, prototyping, and testing the integration of the ESP32 microcontrollers, MQ-3 sensor, relay control, and the Smartphone-Tethered IoT architecture. This design is appropriate because it allows the researchers to evaluate the system’s functional stability, accuracy, and reliability as it evolves from a concept into a working hardware-software solution.  
**Setting of the Study**  
The study will be conducted within the municipality of Bocaue, Central Luzon, Philippines, where the MotoLock IoT Safe-Ride System will be implemented and evaluated. The local road networks, rider communities, and user households serve as the primary deployment ground for testing the integrated hardware and mobile application. This setting is appropriate as it provides a real-world environment for assessing the effectiveness, efficiency, reliability, and user satisfaction of the IoT-based safety system. Conducting the study in Bocaue allows the researchers to gather accurate quantitative data from actual motorcycle riders and system users under realistic conditions, thereby ensuring that the findings reflect the system’s performance in an authentic road safety and accident prevention context.  
***Table 3***   
*Respondent distribution according to type of end-user*

| End-Users | Number of Respondents |
| ----- | :---: |
| Motorcycle Riders | 5 |
| Emergency Contacts | 10 |
| IT Experts | 5 |
| Total | 20 |

The distribution of respondents for this study includes active motorcycle riders who directly utilize the system for safety verification, their designated emergency companions who receive real-time alerts, and system administrators responsible for monitoring compliance and analytics.  
**Research Instrument and Validation**  
The research utilizes a dual evaluation framework to assess the technical robustness and user acceptance of the MotoLock system. The project employs the International Organization for Standardization (ISO) evaluation tool, specifically the ISO/IEC 25010:2023 Software Quality Model. This model serves as the primary instrument for evaluating the software's product quality characteristics, namely: functional suitability, reliability, performance efficiency, interaction capability, security, compatibility, maintainability, flexibility and safety. These characteristics are essential for ensuring that the ESP32 microcontrollers, Bluetooth communications, and AI validation modules operate with the necessary precision and stability required for an automotive safety intervention. Additionally, the Technology Acceptance Model (TAM) functions as a tool for assessing the participants' perceptions regarding the system's perceived usefulness and perceived ease of use in preventing drunk driving incidents.    
The evaluation tool was validated by the designated end-users and subject matter experts to ensure comprehensive feedback. These evaluators include IT experts specializing in IoT and software architecture, mechanical and automotive experts, system administrators, active motorcycle riders, and their designated emergency contacts. By including automotive professionals, the researchers can verify that the Engine Lock Control Module and the LM2596 Buck Converter are installed according to industry standards, ensuring functional stability and preventing long-term damage to the motorcycle’s battery or engine.  
**Research Design**  
A Descriptive-Developmental research design was used to develop the MotoLock IoT-based alcohol detection and companion-assisted safe-ride system. This approach involved the collection of numerical data to categorize system features, quantify sensor accuracy, and create statistical models to evaluate the reliability of Identity Validation and Sobriety Analysis modules. Descriptive research was chosen to gather and interpret user requirements and road safety data, going beyond mere data collection to include the comparison, contrast, measurement, and evaluation of the system's functional stability against current road safety standards and the ISO/IEC 25010:2023 software quality model.  
**Data Gathering Procedure**  
The data gathering procedure was conducted systematically to ensure the accuracy, reliability, and ethical integrity of the study. Prior to the conduct of interviews and data collection, request letters were submitted to the concerned individuals and offices, including motorcycle riders, engineers, and representatives from the Land Transportation Office (LTO), to formally seek permission for participation in the study. After approval was obtained, the purpose and objectives of the research were explained to the participants, and their consent was secured before proceeding with the interviews and evaluation activities.  
Interviews were conducted with motorcycle riders, engineers, and LTO representatives to gather information regarding existing road safety issues, drunk-driving prevention practices, and recommendations relevant to the development of the MotoLock system. The collected information served as the basis for identifying system requirements, improving hardware and software functionalities, and enhancing the overall design of the proposed system.  
After the development of the MotoLock prototype and web-based dashboard, evaluation questionnaires based on ISO/IEC 25010:2023 and TAM were distributed to selected respondents. The respondents assessed the system in terms of functionality, usability, reliability, security, performance efficiency, and user acceptance. The accomplished questionnaires were collected, reviewed, and organized to ensure completeness and consistency of responses.  
The gathered data were encoded, tabulated, and analyzed using appropriate statistical methods to determine the overall evaluation and acceptability of the proposed MotoLock system.  
**Data Analysis and Statistical Treatment**  
**Table 4**   
*TAM Evaluation scale*

| Mean | Interpretation |
| :---: | :---: |
| 4.21 – 5.00 | Strongly Agree |
| 3.41 – 4.20 | Agree |
| 2.61 – 3.40  | Neutral |
| 1.81 – 2.60 | Disagree |
| 1.00 – 1.80  | Strongly Disagree |

**Table 5**   
*ISO Evaluation scale*

| Mean | Interpretation |
| :---: | :---: |
| 4.21 – 5.00 | Excellent |
| 3.41 – 4.20 | Good |
| 2.61 – 3.40  | Satisfactory |
| 1.81 – 2.60  | Needs Improvement |
| 1.00 – 1.80  | Poor |

**Ethical Considerations**  
Maintaining ethical integrity is essential in the conduct of this study. Ethical principles were carefully observed to protect the rights, privacy, safety, and well-being of all participants involved in the development and evaluation of the MotoLock system. The study involved motorcycle riders, engineers, and representatives from the Land Transportation Office (LTO). Therefore, proper ethical procedures were implemented throughout the research process.  
**Ethical Approval**  
Before conducting interviews, testing, and data gathering procedures, formal request letters were submitted to the concerned individuals and institutions to seek permission for participation and data collection. Coordination was conducted with motorcycle riders, engineers, and the LTO chief to ensure that all activities related to the study were properly authorized and ethically conducted. The study adhered to institutional research guidelines and ethical standards to ensure responsible handling of participant involvement and collected information.  
**Informed Consent**  
All participants were informed about the objectives, procedures, and purpose of the study before participating in interviews, system testing, and evaluation activities. Participants were clearly informed that their participation was voluntary and that they had the right to refuse participation or withdraw from the study at any time without penalty. Prior to the conduct of interviews and testing procedures, consent was obtained from the participants to confirm their willingness to participate in the research.  
**Privacy and Confidentiality**  
The researchers will implement sstrict confidentiality measures were implemented to protect the personal information and responses of all participants. Personal data such as names, contact details, and individual responses gathered during interviews and system evaluations were treated as confidential and were used solely for academic and research purposes. All collected data were securely stored in password-protected digital files accessible only to authorized individuals involved in the study. Information presented in reports, documentation, and system records was anonymized to prevent identification of participants.  
**Minimization of Harm**  
The study ensured that all interview and data-gathering procedures posed no physical, emotional, or psychological harm to the participants. The interviews conducted with motorcycle riders, engineers, and representatives from the Land Transportation Office (LTO) focused only on information relevant to the objectives of the study. Participants were treated with respect and were free to decline answering any question they were uncomfortable with. Additionally, participation in the study was entirely voluntary, and respondents were allowed to withdraw from the interview process at any time without any negative consequences.

**Fair and Equitable Participation**  
Participants were selected based on the objectives and requirements of the study using purposive sampling. Equal opportunity was given to qualified motorcycle riders, engineers, and emergency contacts who met the inclusion criteria. No participant was forced or pressured to join the study, and all participation was conducted voluntarily without discrimination based on gender, occupation, or social background.  
**Responsible Data Handling and Disposal**  
All gathered information, interview responses, and research documents were handled responsibly throughout the conduct of the study. The data collected from motorcycle riders, engineers, and representatives from the Land Transportation Office (LTO) were used strictly for academic and research purposes only. Digital files and documentation related to the study were securely stored and accessed only by the members involved in the research. After the completion of the study, all collected data will be properly archived and disposed of according to institutional research guidelines to maintain confidentiality and prevent unauthorized access

**References**   
Abu Al-Haija, Q., & Krichen, M. (2022). A lightweight in-vehicle alcohol detection using smart sensing and supervised learning. Computers, 11(8), 121\.  
Aher, P., Nagpure, L., Darode, S., Bagde, S., & Kalbagwar, S. (2023). *Implementation of smart helmet based on IoT*. International Journal for Research in Applied Science & Engineering Technology, 11(4). https://doi.org/10.22214/ijraset.2023.50458  
Alsayaydeh, J. J., Yusof, M. F. B., Mohan, K. S., Hossain, A. K. M. Z., & Leoshchenko, S. (2023). Advancing road safety: precision driver detection system with integrated overspeed, alcohol detection, and tracking capabilities. International Journal of Advanced Computer Science and Applications, 14(12).   
Aminboevich, K. M., & Ugli, B. U. T. (2025). REAL-TIME ALCOHOL DETECTION AND ENGINE LOCKING SYSTEM FOR THE PREVENTION OF ROAD TRAFFIC ACCIDENTS. Илм-фан ва инновацион ривожланиш/Наука и инновационное развитие, 8(5), 57-64.    
Baig, F., Muhammad Abrar, Chen, H., & Sherif, M. (2022). Rainfall Consistency, Variability, and Concentration over the UAE: Satellite Precipitation Products vs. Rain Gauge Observations. Remote Sensing, 14(22), 5827–5827. https://doi.org/10.3390/rs14225827   
Brobbin, E., Deluca, P., Hemrage, S., & Drummond, C. (2022). Accuracy of wearable transdermal alcohol sensors: systematic review. *Journal of Medical Internet Research*, *24*(4), e35178.   
Celaya-Padilla, J. M., Romero-González, J. S., Galvan-Tejada, C. E., Galvan-Tejada, J. I., Luna-García, H., Arceo-Olague, J. G., ... & Gamboa-Rosales, H. (2021). In-vehicle alcohol detection using low-cost sensors and genetic algorithms to aid in the drinking and driving detection. Sensors, 21(22), 7752.   
Dong, M., Lee, Y. Y., Cha, J. S., & Huang, G. (2024). Drinking and driving: A systematic review of the impacts of alcohol consumption on manual and automated driving performance. Journal of safety research, 89, 1-12.   
ESP32 Relay Guide. (2026, January 24). ESP32 Relay Guide \- Choosing the Right Module for Home Automation. Espboards.dev. [https://www.espboards.dev/blog/esp32-relay-guide/](https://www.espboards.dev/blog/esp32-relay-guide/)   
Farooq, H., Altaf, A., Iqbal, F., Galán, J. C., Aray, D. G., & Ashraf, I. (2023). DrunkChain: blockchain-based IoT system for preventing drunk driving-related traffic accidents. *Sensors*, *23*(12), 5388.   
Hadi, A., Muhamad, Muhammad Zulhilman Mazlan, & Mohd, M. S. (2022). Smart Helmet for Motorcyclist. *Multidisciplinary Applied Research and Innovation*, *3*(2), 318–323. https://publisher.uthm.edu.my/periodicals/index.php/mari/article/view/3458  
Hosan, K. S., Perera, H. V., Vimukthi Vithanage, Dasith Diyal Priyamal Wijesekara Ekanayaka Rathnayaka Jayasundara Mudiyanselage, & Kaveenga Koswattage. (2025). Comparative Analysis of Arduino UNO R3 and ESP32 Microcontrollers: A Multi-Sensor Data Acquisition and Automation Perspective. ComURS2025 Computing Undergraduate Research Symposium 2025\. https://www.researchgate.net/publication/389313726\_Comparative\_Analysis\_of\_Arduino\_UNO\_R3\_and\_ESP32\_Microcontrollers\_A\_Multi-Sensor\_Data\_Acquisition\_and\_Automation\_Perspective   
Høye, A. K., & Storesund Hesjevoll, I. (2023). Alcohol and driving—How bad is the combination? A meta-analysis. *Traffic injury prevention*, *24*(5), 373-378.   
Jorakulyyev, M., Rawshanov, S., Aymedov, S., & Annagulyyeva, B. (2025). RECHARGEABLE ALCOHOL DETECTOR. ОБРАЗОВАНИЕ И НАУКА В XXI ВЕКЕ, (67-1 (том 1)).   
Kingsley, K., da Silva, F. P., & Strassburger, R. (2023). In-vehicle technology to prevent drunk driving: public acceptance required for successful deployment. *Transportation research procedia*, *72*, 2433-2440.   
Kumar, A., & Kumar, A. (2022, August). A literature survey of drunk driving detection approaches. In *Proceedings of the 2022 Fourteenth International Conference on Contemporary Computing* (pp. 342-349).   
Muslam, M. M. A. (2024). Enhancing security in vehicle-to-vehicle communication: A comprehensive review of protocols and techniques. Vehicles, 6(1), 450-467.   
Nanda, I., & De, R. (2022). Automatic engine lock system through alcohol detection in virtual environment. Inform manag comp sci, 5(1), 23-27.    
Paprocki, S., Qassem, M., & Kyriacou, P. A. (2022). Review of ethanol intoxication sensing technologies and techniques. Sensors, 22(18), 6819.   
Rafidi, M. N. A., & Ismail, N. M. A. N. (2021). Development of Alcohol Detection with Ignition Lock System for Vehicles. Evolution in Electrical and Electronic Engineering, 2(2), 173-181.   
Rahman, Md. H., Shihab, M., Rahman, Md. A., & Naderuzzaman, M. (2026). ESP32 Microcontroller: A Review of Architecture, Communication Protocols, Applications and Research Challenges. Open Access Journal on Engineering Applications, 2(1), 19. [https://doi.org/10.64886/oajea.0102.003](https://doi.org/10.64886/oajea.0102.003)   
Rao, Dr. P. Raja. P., & Y.B.T.Sundari. (2022). VEHICLE TRACKING AND MONITORING SYSTEM USING GPS AND GSM, BASED ON IOT. INTERNATIONAL JOURNAL of CURRENT SCIENCE, 12(2), 175–181175–181. [https://www.rjpn.org/ijcspub/viewpaperforall.php?paper=IJCSP22B1132](https://www.rjpn.org/ijcspub/viewpaperforall.php?paper=IJCSP22B1132)   
Rogers, J., & Andrew James Murray. (2022). A low-cost and reliable laser shutter interlock using a software-command interface. Measurement Science & Technology, 33(12), 127002–127002.    
Salih, S. S., & Alsaedi, M. A. (2023). Developed Smart Vehicle Tracking System using GPS and GSM Modem. Al-Iraqia Journal of Scientific Engineering Research, 2(1), 9–12. https://doi.org/10.58564/ijser.2.1.2023.56   
Sebastian, P. M. S., & De Castro, C. J. T. (2025). Prevalence and Resolution of Road Incidents in Cauayan City, Isabela: A Study on Law Enforcement Strategies. *SUKISOK Journal of the Arts and Sciences*, *5*(2).   
Shankar, P. R., Surendra, P. N., Neelima, P., Siddhartha, M., & Begum, S. B. (2023, April). Alcohol detection with engine locking system using GPS. International Research Journal of Engineering and Technology (IRJET). Presented at the International Conference on Recent Trends in Engineering & Technology (ICRTET-3), VSM College of Engineering, Ramachandrapuram, India. https://www.irjet.net   
Simmons, S. M., Caird, J. K., Sterzer, F., & Asbridge, M. (2022). The effects of cannabis and alcohol on driving performance and driver behaviour: a systematic review and meta‐analysis. Addiction, 117(7), 1843-1856.   
Smailović, E., Pešić, D., Antić, B., & Marković, N. (2023). A review of factors associated with driving under the influence of alcohol. Transportation research procedia, 69, 281-288. ‌  
Tafidis, P., Farah, H., Brijs, T., & Pirdavani, A. (2022). Safety implications of higher levels of automated vehicles: a scoping review. *Transport reviews*, *42*(2), 245-267.   
Texas Instruments. (2023). LM2596 SIMPLE SWITCHER ® Power Converter 150-kHz 3-A Step-Down Voltage Regulator. https://www.ti.com/lit/ds/symlink/lm2596.pdf   
Tupas, E. (2022, December 22). Due to drunk driving: Road crashes up by 90% – HPG. *Philstar.com*. [https://www.philstar.com/nation/2022/12/23/2232737/due-drunk-driving-road-crashes-90-hpg-](https://www.philstar.com/nation/2022/12/23/2232737/due-drunk-driving-road-crashes-90-hpg-)   
Üremek, İ., Leahy, P., & Popovici, E. (2024). A System for Efficient Detection of Forest Fires through Low Power Environmental Data Monitoring and AI. ITISE 2024, 38\. https://doi.org/10.3390/engproc2024068038   
Visconti, P., Rausa, G., Del-Valle-Soto, C., Velázquez, R., Cafagna, D., & De Fazio, R. (2025). Innovative driver monitoring systems and on-board-vehicle devices in a smart-road scenario based on the internet of vehicle paradigm: A literature and commercial solutions overview. *Sensors*, *25*(2), 562.   
Wang, X., Jiang, H., Zhang, X., Si, R., Li, G., Hong, Z., & Zhang, S. (2025). Development of intelligent drinking detection systems for vehicles. *Sensors and Actuators B: Chemical*, 138732.   
World Health Organization. (2023, December 13). *Global status report on road safety 2023*. [https://www.who.int/teams/social-determinants-of-health/safety-and-mobility/global-status-report-on-road-safety-2023](https://www.who.int/teams/social-determinants-of-health/safety-and-mobility/global-status-report-on-road-safety-2023)   
Zhao, S., Li, Q., & Cao, H. (2023). Improved Smooth Watermarking Methods for Detecting Replay Attacks in Process Control Systems. Electronics, 12(18), 3812–3812. https://doi.org/10.3390/electronics12183812   
IEC 61508\. (2010). *Functional Safety of Electrical/Electronic/Programmable Electronic Safety-Related Systems*. [https://www.intertek.com/etl/standards/iec-61508/](https://www.intertek.com/etl/standards/iec-61508/)  
Siemens. (2024). *Fail-Safe Automation Systems and Fail-Safe Modules*. [https://docs.tia.siemens.cloud/r/simatic\_et\_200al\_manual\_collection\_eses\_20/basic-information/distributed-i/o-system/system-overview/what-are-fail-safe-automation-systems-and-fail-safe-modules/](https://docs.tia.siemens.cloud/r/simatic_et_200al_manual_collection_eses_20/basic-information/distributed-i/o-system/system-overview/what-are-fail-safe-automation-systems-and-fail-safe-modules/)   
Alhammad, et al. (2024). *Fault Tolerance Methods in Embedded Systems*. [https://arxiv.org/html/2404.10509v1/](https://arxiv.org/html/2404.10509v1/)   
Optima Design Automation. (2019). *ISO 26262 Primer White Paper*. [https://www.optima-da.com/wp-content/uploads/2019/10/Optima-ISO-26262-Primer-White-Paper-191028.pdf/](https://www.optima-da.com/wp-content/uploads/2019/10/Optima-ISO-26262-Primer-White-Paper-191028.pdf/)   
Armoush, A. (2009). *Design Patterns for Safety-Critical Embedded Systems*. https://staff old.najah.edu/sites/default/files/Design\_Pattern\_Representation\_for\_Safety-Critical\_Embedded\_Systems.pdf/   
MIT OpenCourseWare. (2016). System Safety Lecture Notes. [https://ocw.mit.edu/courses/16-63j-system-safety-spring-2016/6d88a0eb8b9e2b06501ebb06f75254d7\_MIT16\_63JS16\_LecNotes14.pdf/](https://ocw.mit.edu/courses/16-63j-system-safety-spring-2016/6d88a0eb8b9e2b06501ebb06f75254d7_MIT16_63JS16_LecNotes14.pdf/) 












































Santos, A. G., Carmo, L. F. D. C., & Prado, C. B. (2022). Machine Learning in Failure Prediction in Breathalyzers. Research Square. https://doi.org/10.21203/rs.3.rs-2239230/v1
Tusa, F., Clayman, S., Buzachis, A., & Fazio, M. (2024). Microservices and serverless functions—lifecycle, performance, and resource utilisation of edge based real-time IoT analytics. Future Generation Computer Systems, 155, 204-218.
Wu, Z., Cheng, Y., Yang, J., Ji, X., & Xu, W. (2023, May). DepthFake: Spoofing 3D face authentication with a 2D photo. In 2023 IEEE symposium on security and privacy (SP) (pp. 917-933). IEEE.


