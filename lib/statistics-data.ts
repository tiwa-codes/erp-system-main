export const METRICS_BY_PERIOD = {
      today: {
        kpis: {
          erpUsers: 68, providerUsers: 124, enrolleeUsers: 512, totalLogins: 1048,
          androidUsers: 341, iosUsers: 171, dropOff: 23, avgSession: '8m 40s'
        },
        insights: [
          'Most used module today: <strong>Claims</strong>',
          'Highest drop-off point: <strong>OTP Verification Screen</strong>',
          'Most active region: <strong>South West</strong>',
          'Peak login window: <strong>9:00 AM – 11:00 AM</strong>',
          'Most used app feature: <strong>Provider Search</strong>'
        ],
        activeUsersTrend: [120, 138, 142, 160, 170, 188, 201],
        moduleUsage: [120, 95, 76, 60, 44, 38],
        hourlyUsage: [12, 20, 44, 72, 98, 84, 68],
        erp: {
          totalUsers: 104, loggedInToday: 68, inactiveUsers: 14, mostUsedModule: 'Claims',
          moduleChart: [84, 60, 46, 32, 24, 18],
          table: [
            ['Yusuf Okunla', 'Senior Technical Officer', 'IT', '09:14 AM', 14, 'Claims', 93, 'Active'],
            ['Amina Bala', 'Underwriting Officer', 'Underwriting', '08:49 AM', 11, 'Underwriting', 54, 'Active'],
            ['Noel Daniel', 'Finance Officer', 'Finance', '10:02 AM', 8, 'Finance', 37, 'Active'],
            ['Grace Emmanuel', 'Claims Auditor', 'Operations', '09:31 AM', 13, 'Claims', 69, 'Active'],
            ['Moses Aliyu', 'Call Centre Agent', 'Call Centre', '07:55 AM', 7, 'Call Centre', 31, 'Inactive']
          ]
        },
        provider: {
          registered: 958, loggedIn: 124, approvalCodes: 266, claims: 118,
          actionChart: [266, 118, 39, 54],
          table: [
            ['Reddington Hospital', 'Lagos', '09:22 AM', 12, 32, 16, 4, '11m 22s'],
            ['LifeBridge Clinic', 'Abuja', '08:41 AM', 7, 18, 8, 3, '9m 10s'],
            ['City Care Hospital', 'Rivers', '10:03 AM', 9, 24, 12, 1, '8m 55s'],
            ['Prime Medical Centre', 'Enugu', '07:51 AM', 6, 9, 4, 2, '6m 48s']
          ]
        },
        enrollee: {
          appUsers: 512, newSignups: 44, returning: 468, loggedIn: 401,
          featureChart: [210, 188, 120, 84, 72, 55],
          table: [
            ['Aisha Bello', 'CJH00012', 'Android', 'Samsung A54', '09:40 AM', 8, 'Provider Search', '7m 45s', 'Lagos'],
            ['Chinedu Obi', 'CJH00420', 'iOS', 'iPhone 13', '08:17 AM', 5, 'Benefits', '6m 08s', 'Abuja'],
            ['Mary Okon', 'CJH00188', 'Android', 'Redmi Note 12', '10:11 AM', 7, 'Telemedicine', '11m 15s', 'Rivers'],
            ['John James', 'CJH00291', 'iOS', 'iPhone 11', '07:42 AM', 4, 'Chat Support', '5m 32s', 'Lagos']
          ]
        },
        login: {
          attempts: 1252, success: 1048, failed: 204, otp: 441,
          loginChart: [1048, 204],
          sessionChart: [9, 8, 10, 7, 8, 9, 11],
          table: [
            ['Aisha Bello', 'Enrollee', 'Android', 'Samsung A54', '09:40 AM', '09:48 AM', '8m', 'Success', '-'],
            ['LifeBridge Clinic', 'Provider', 'Web', 'Chrome', '08:41 AM', '08:50 AM', '9m', 'Success', '-'],
            ['Moses Aliyu', 'ERP Staff', 'Web', 'Edge', '07:55 AM', '-', '-', 'Failed', 'Wrong password'],
            ['Chinedu Obi', 'Enrollee', 'iOS', 'iPhone 13', '08:17 AM', '08:23 AM', '6m', 'Success', '-']
          ]
        },
        dropoff: {
          highest: 'OTP Verification',
          rate: 23,
          completion: 77,
          funnel: 77,
          enrolleeSteps: [
            ['App Opened', 100],
            ['Login Started', 84],
            ['OTP Requested', 72],
            ['OTP Verified', 61],
            ['Dashboard Reached', 58],
            ['Action Completed', 44]
          ],
          providerSteps: [
            ['Portal Login', 100],
            ['Dashboard Reached', 91],
            ['Approval Code Started', 74],
            ['Services Added', 66],
            ['Submitted Successfully', 53]
          ],
          table: [
            ['OTP Login Process', 441, 339, 102, '23%', 'OTP Verification Screen'],
            ['Telemedicine Booking', 89, 51, 38, '43%', 'Select Date / Time'],
            ['Approval Code Request', 266, 212, 54, '20%', 'Service Selection'],
            ['Claims Submission', 118, 87, 31, '26%', 'Upload Bills']
          ]
        },
        daily: {
          dashboard: 510, providerSearch: 188, telemedicine: 72, chat: 55,
          trend: [220, 240, 260, 245, 280, 310, 330],
          distribution: [188, 160, 72, 55, 90, 120],
          table: [
            ['2026-04-03', 462, 690, 'Provider Search', 'Profile Update', '7m', 120, 18],
            ['2026-04-04', 470, 712, 'Benefits', 'Chat Support', '7m', 131, 20],
            ['2026-04-05', 488, 730, 'Provider Search', 'Claims History', '8m', 144, 16],
            ['2026-04-06', 493, 745, 'Telemedicine', 'Profile Update', '8m', 138, 17],
            ['2026-04-07', 501, 760, 'Benefits', 'Chat Support', '8m', 149, 19],
            ['2026-04-08', 506, 774, 'Provider Search', 'Claims History', '8m', 152, 22],
            ['2026-04-09', 512, 790, 'Provider Search', 'Profile Update', '9m', 160, 21]
          ]
        },
        device: {
          android: 341, ios: 171, androidErrors: 12, iosErrors: 4,
          platformChart: [341, 171],
          versionChart: [210, 180, 92, 30],
          table: [
            ['Android', 'Samsung A54', '1.0.2', 'Android 14', 82, 4, '8m'],
            ['Android', 'Redmi Note 12', '1.0.1', 'Android 13', 65, 3, '7m'],
            ['iOS', 'iPhone 13', '1.0.2', 'iOS 18', 74, 2, '9m'],
            ['iOS', 'iPhone 11', '1.0.1', 'iOS 17', 51, 2, '7m']
          ]
        },
        reports: {
          summary: [
            'App adoption is strongest in <strong>South West</strong>.',
            'Provider usage is improving, with <strong>approval code requests</strong> remaining the top action.',
            'Main drop-off still occurs at <strong>OTP verification</strong>.',
            'Android usage is about <strong>2x</strong> iOS usage.'
          ],
          regional: [
            ['South West', 31, 58, 224, 434, '19%', 'Provider Search'],
            ['North', 16, 28, 110, 228, '24%', 'Benefits'],
            ['South South', 12, 21, 98, 190, '27%', 'Telemedicine'],
            ['South East', 9, 17, 80, 161, '26%', 'Chat Support']
          ]
        }
      },

      '7days': {
        kpis: {
          erpUsers: 122, providerUsers: 289, enrolleeUsers: 1846, totalLogins: 4680,
          androidUsers: 1211, iosUsers: 635, dropOff: 21, avgSession: '9m 12s'
        },
        insights: [
          'Most used module in the last 7 days: <strong>Claims</strong>',
          'Highest drop-off point: <strong>OTP Verification Screen</strong>',
          'Most active region: <strong>South West</strong>',
          'Peak login window: <strong>8:00 AM – 10:00 AM</strong>',
          'Most used app feature: <strong>Benefits & Provider Search</strong>'
        ],
        activeUsersTrend: [510, 560, 602, 650, 690, 742, 790],
        moduleUsage: [520, 410, 290, 240, 180, 160],
        hourlyUsage: [44, 78, 120, 180, 220, 205, 170],
        erp: {
          totalUsers: 146, loggedInToday: 122, inactiveUsers: 17, mostUsedModule: 'Claims',
          moduleChart: [212, 154, 122, 100, 78, 60],
          table: [
            ['Yusuf Okunla', 'Senior Technical Officer', 'IT', 'Today 09:14 AM', 42, 'Claims', 282, 'Active'],
            ['Amina Bala', 'Underwriting Officer', 'Underwriting', 'Today 08:49 AM', 31, 'Underwriting', 204, 'Active'],
            ['Noel Daniel', 'Finance Officer', 'Finance', 'Today 10:02 AM', 24, 'Finance', 160, 'Active'],
            ['Grace Emmanuel', 'Claims Auditor', 'Operations', 'Today 09:31 AM', 37, 'Claims', 239, 'Active'],
            ['Moses Aliyu', 'Call Centre Agent', 'Call Centre', 'Yesterday 07:55 AM', 18, 'Call Centre', 111, 'Inactive']
          ]
        },
        provider: {
          registered: 958, loggedIn: 289, approvalCodes: 691, claims: 332,
          actionChart: [691, 332, 87, 130],
          table: [
            ['Reddington Hospital', 'Lagos', 'Today 09:22 AM', 42, 88, 47, 12, '12m 02s'],
            ['LifeBridge Clinic', 'Abuja', 'Today 08:41 AM', 27, 50, 29, 9, '10m 16s'],
            ['City Care Hospital', 'Rivers', 'Today 10:03 AM', 31, 63, 36, 6, '9m 08s'],
            ['Prime Medical Centre', 'Enugu', 'Yesterday 07:51 AM', 18, 26, 13, 5, '7m 45s']
          ]
        },
        enrollee: {
          appUsers: 1846, newSignups: 192, returning: 1654, loggedIn: 1455,
          featureChart: [711, 676, 280, 210, 190, 155],
          table: [
            ['Aisha Bello', 'CJH00012', 'Android', 'Samsung A54', 'Today 09:40 AM', 18, 'Provider Search', '9m 45s', 'Lagos'],
            ['Chinedu Obi', 'CJH00420', 'iOS', 'iPhone 13', 'Today 08:17 AM', 12, 'Benefits', '7m 08s', 'Abuja'],
            ['Mary Okon', 'CJH00188', 'Android', 'Redmi Note 12', 'Today 10:11 AM', 16, 'Telemedicine', '12m 15s', 'Rivers'],
            ['John James', 'CJH00291', 'iOS', 'iPhone 11', 'Today 07:42 AM', 9, 'Chat Support', '6m 32s', 'Lagos']
          ]
        },
        login: {
          attempts: 5214, success: 4680, failed: 534, otp: 1711,
          loginChart: [4680, 534],
          sessionChart: [8, 9, 10, 9, 11, 10, 9],
          table: [
            ['Aisha Bello', 'Enrollee', 'Android', 'Samsung A54', 'Today 09:40 AM', 'Today 09:50 AM', '10m', 'Success', '-'],
            ['LifeBridge Clinic', 'Provider', 'Web', 'Chrome', 'Today 08:41 AM', 'Today 08:52 AM', '11m', 'Success', '-'],
            ['Moses Aliyu', 'ERP Staff', 'Web', 'Edge', 'Yesterday 07:55 AM', '-', '-', 'Failed', 'Wrong password'],
            ['Chinedu Obi', 'Enrollee', 'iOS', 'iPhone 13', 'Today 08:17 AM', 'Today 08:24 AM', '7m', 'Success', '-']
          ]
        },
        dropoff: {
          highest: 'OTP Verification',
          rate: 21,
          completion: 79,
          funnel: 79,
          enrolleeSteps: [
            ['App Opened', 100],
            ['Login Started', 87],
            ['OTP Requested', 74],
            ['OTP Verified', 65],
            ['Dashboard Reached', 61],
            ['Action Completed', 49]
          ],
          providerSteps: [
            ['Portal Login', 100],
            ['Dashboard Reached', 92],
            ['Approval Code Started', 76],
            ['Services Added', 68],
            ['Submitted Successfully', 56]
          ],
          table: [
            ['OTP Login Process', 1711, 1352, 359, '21%', 'OTP Verification Screen'],
            ['Telemedicine Booking', 280, 170, 110, '39%', 'Select Date / Time'],
            ['Approval Code Request', 691, 554, 137, '20%', 'Service Selection'],
            ['Claims Submission', 332, 251, 81, '24%', 'Upload Bills']
          ]
        },
        daily: {
          dashboard: 1780, providerSearch: 676, telemedicine: 280, chat: 155,
          trend: [650, 700, 760, 790, 840, 900, 940],
          distribution: [676, 640, 280, 155, 310, 390],
          table: [
            ['2026-04-03', 1450, 2210, 'Benefits', 'Profile Update', '8m', 410, 52],
            ['2026-04-04', 1512, 2284, 'Provider Search', 'Chat Support', '8m', 429, 47],
            ['2026-04-05', 1600, 2360, 'Benefits', 'Claims History', '9m', 450, 44],
            ['2026-04-06', 1664, 2422, 'Provider Search', 'Profile Update', '9m', 461, 50],
            ['2026-04-07', 1708, 2490, 'Telemedicine', 'Chat Support', '9m', 478, 49],
            ['2026-04-08', 1760, 2575, 'Provider Search', 'Claims History', '9m', 491, 53],
            ['2026-04-09', 1846, 2660, 'Benefits', 'Profile Update', '10m', 518, 57]
          ]
        },
        device: {
          android: 1211, ios: 635, androidErrors: 38, iosErrors: 16,
          platformChart: [1211, 635],
          versionChart: [710, 620, 390, 126],
          table: [
            ['Android', 'Samsung A54', '1.0.2', 'Android 14', 291, 11, '9m'],
            ['Android', 'Redmi Note 12', '1.0.1', 'Android 13', 244, 8, '8m'],
            ['iOS', 'iPhone 13', '1.0.2', 'iOS 18', 278, 6, '10m'],
            ['iOS', 'iPhone 11', '1.0.1', 'iOS 17', 201, 5, '8m']
          ]
        },
        reports: {
          summary: [
            'User adoption remains strongest in <strong>South West</strong>.',
            'Both <strong>Benefits</strong> and <strong>Provider Search</strong> are the most used app features.',
            'OTP verification still needs improvement to reduce login drop-off.',
            'Provider portal activity is rising steadily with better claims usage.'
          ],
          regional: [
            ['South West', 52, 114, 680, 1640, '18%', 'Provider Search'],
            ['North', 31, 71, 420, 1080, '22%', 'Benefits'],
            ['South South', 22, 58, 390, 944, '24%', 'Telemedicine'],
            ['South East', 17, 46, 356, 816, '23%', 'Chat Support']
          ]
        }
      },

      '30days': {
        kpis: {
          erpUsers: 138, providerUsers: 621, enrolleeUsers: 5420, totalLogins: 14180,
          androidUsers: 3510, iosUsers: 1910, dropOff: 19, avgSession: '10m 03s'
        },
        insights: [
          'Most used module in the last 30 days: <strong>Claims</strong>',
          'Highest drop-off point: <strong>OTP Verification Screen</strong>',
          'Most active region: <strong>South West</strong>',
          'Peak login window: <strong>8:00 AM – 11:00 AM</strong>',
          'Most used app feature: <strong>Benefits</strong>'
        ],
        activeUsersTrend: [2100, 2450, 2800, 3100, 3400, 3800, 4200],
        moduleUsage: [2100, 1610, 1220, 980, 710, 640],
        hourlyUsage: [110, 200, 320, 400, 530, 470, 380],
        erp: {
          totalUsers: 146, loggedInToday: 138, inactiveUsers: 8, mostUsedModule: 'Claims',
          moduleChart: [860, 590, 470, 380, 280, 210],
          table: [
            ['Yusuf Okunla', 'Senior Technical Officer', 'IT', 'Today 09:14 AM', 162, 'Claims', 1042, 'Active'],
            ['Amina Bala', 'Underwriting Officer', 'Underwriting', 'Today 08:49 AM', 128, 'Underwriting', 860, 'Active'],
            ['Noel Daniel', 'Finance Officer', 'Finance', 'Today 10:02 AM', 98, 'Finance', 611, 'Active'],
            ['Grace Emmanuel', 'Claims Auditor', 'Operations', 'Today 09:31 AM', 141, 'Claims', 930, 'Active'],
            ['Moses Aliyu', 'Call Centre Agent', 'Call Centre', 'Yesterday 07:55 AM', 77, 'Call Centre', 438, 'Active']
          ]
        },
        provider: {
          registered: 958, loggedIn: 621, approvalCodes: 1712, claims: 844,
          actionChart: [1712, 844, 205, 391],
          table: [
            ['Reddington Hospital', 'Lagos', 'Today 09:22 AM', 121, 228, 124, 32, '12m 45s'],
            ['LifeBridge Clinic', 'Abuja', 'Today 08:41 AM', 88, 154, 76, 22, '10m 51s'],
            ['City Care Hospital', 'Rivers', 'Today 10:03 AM', 92, 166, 82, 18, '9m 55s'],
            ['Prime Medical Centre', 'Enugu', 'Yesterday 07:51 AM', 71, 101, 47, 16, '8m 01s']
          ]
        },
        enrollee: {
          appUsers: 5420, newSignups: 620, returning: 4800, loggedIn: 4290,
          featureChart: [2180, 2090, 780, 620, 502, 410],
          table: [
            ['Aisha Bello', 'CJH00012', 'Android', 'Samsung A54', 'Today 09:40 AM', 52, 'Benefits', '10m 10s', 'Lagos'],
            ['Chinedu Obi', 'CJH00420', 'iOS', 'iPhone 13', 'Today 08:17 AM', 39, 'Benefits', '8m 32s', 'Abuja'],
            ['Mary Okon', 'CJH00188', 'Android', 'Redmi Note 12', 'Today 10:11 AM', 48, 'Telemedicine', '13m 05s', 'Rivers'],
            ['John James', 'CJH00291', 'iOS', 'iPhone 11', 'Today 07:42 AM', 31, 'Provider Search', '7m 11s', 'Lagos']
          ]
        },
        login: {
          attempts: 15632, success: 14180, failed: 1452, otp: 5120,
          loginChart: [14180, 1452],
          sessionChart: [9, 9, 10, 10, 11, 10, 11],
          table: [
            ['Aisha Bello', 'Enrollee', 'Android', 'Samsung A54', 'Today 09:40 AM', 'Today 09:51 AM', '11m', 'Success', '-'],
            ['LifeBridge Clinic', 'Provider', 'Web', 'Chrome', 'Today 08:41 AM', 'Today 08:53 AM', '12m', 'Success', '-'],
            ['Moses Aliyu', 'ERP Staff', 'Web', 'Edge', 'Yesterday 07:55 AM', '-', '-', 'Failed', 'OTP expired'],
            ['Chinedu Obi', 'Enrollee', 'iOS', 'iPhone 13', 'Today 08:17 AM', 'Today 08:25 AM', '8m', 'Success', '-']
          ]
        },
        dropoff: {
          highest: 'OTP Verification',
          rate: 19,
          completion: 81,
          funnel: 81,
          enrolleeSteps: [
            ['App Opened', 100],
            ['Login Started', 89],
            ['OTP Requested', 77],
            ['OTP Verified', 69],
            ['Dashboard Reached', 66],
            ['Action Completed', 54]
          ],
          providerSteps: [
            ['Portal Login', 100],
            ['Dashboard Reached', 93],
            ['Approval Code Started', 79],
            ['Services Added', 72],
            ['Submitted Successfully', 61]
          ],
          table: [
            ['OTP Login Process', 5120, 4148, 972, '19%', 'OTP Verification Screen'],
            ['Telemedicine Booking', 780, 482, 298, '38%', 'Select Date / Time'],
            ['Approval Code Request', 1712, 1394, 318, '19%', 'Service Selection'],
            ['Claims Submission', 844, 652, 192, '23%', 'Upload Bills']
          ]
        },
        daily: {
          dashboard: 5220, providerSearch: 2090, telemedicine: 780, chat: 410,
          trend: [2480, 2690, 2810, 2950, 3120, 3340, 3510],
          distribution: [2090, 2180, 780, 410, 702, 960],
          table: [
            ['2026-04-03', 4780, 7200, 'Benefits', 'Profile Update', '9m', 1200, 148],
            ['2026-04-04', 4862, 7344, 'Provider Search', 'Chat Support', '9m', 1248, 155],
            ['2026-04-05', 4974, 7420, 'Benefits', 'Claims History', '10m', 1282, 141],
            ['2026-04-06', 5052, 7582, 'Provider Search', 'Profile Update', '10m', 1310, 150],
            ['2026-04-07', 5190, 7804, 'Benefits', 'Chat Support', '10m', 1355, 157],
            ['2026-04-08', 5300, 7922, 'Provider Search', 'Claims History', '10m', 1388, 162],
            ['2026-04-09', 5420, 8105, 'Benefits', 'Profile Update', '11m', 1420, 169]
          ]
        },
        device: {
          android: 3510, ios: 1910, androidErrors: 108, iosErrors: 39,
          platformChart: [3510, 1910],
          versionChart: [1820, 1710, 1290, 600],
          table: [
            ['Android', 'Samsung A54', '1.0.2', 'Android 14', 850, 24, '10m'],
            ['Android', 'Redmi Note 12', '1.0.1', 'Android 13', 720, 19, '9m'],
            ['iOS', 'iPhone 13', '1.0.2', 'iOS 18', 788, 11, '11m'],
            ['iOS', 'iPhone 11', '1.0.1', 'iOS 17', 570, 9, '8m']
          ]
        },
        reports: {
          summary: [
            'The app has strong adoption, especially on <strong>Android</strong>.',
            '<strong>Benefits</strong> is now the strongest-used mobile feature.',
            'Provider portal activity improved across claims and code requests.',
            'OTP verification remains the main area for flow improvement.'
          ],
          regional: [
            ['South West', 60, 232, 1980, 5020, '17%', 'Benefits'],
            ['North', 36, 144, 1260, 3320, '20%', 'Provider Search'],
            ['South South', 24, 133, 1122, 2920, '22%', 'Telemedicine'],
            ['South East', 18, 112, 1058, 2920, '21%', 'Benefits']
          ]
        }
      },

      '90days': {
        kpis: {
          erpUsers: 145, providerUsers: 811, enrolleeUsers: 11840, totalLogins: 33120,
          androidUsers: 7735, iosUsers: 4105, dropOff: 17, avgSession: '10m 55s'
        },
        insights: [
          'Most used module in the last 90 days: <strong>Claims</strong>',
          'Highest drop-off point: <strong>OTP Verification Screen</strong>',
          'Most active region: <strong>South West</strong>',
          'Peak login window: <strong>8:00 AM – 11:00 AM</strong>',
          'Most used app feature: <strong>Benefits</strong>'
        ],
        activeUsersTrend: [4800, 5900, 7100, 8300, 9500, 10600, 11840],
        moduleUsage: [4510, 3200, 2440, 1880, 1450, 1210],
        hourlyUsage: [200, 340, 520, 740, 880, 790, 640],
        erp: {
          totalUsers: 146, loggedInToday: 145, inactiveUsers: 3, mostUsedModule: 'Claims',
          moduleChart: [2100, 1520, 1200, 950, 740, 480],
          table: [
            ['Yusuf Okunla', 'Senior Technical Officer', 'IT', 'Today 09:14 AM', 481, 'Claims', 3202, 'Active'],
            ['Amina Bala', 'Underwriting Officer', 'Underwriting', 'Today 08:49 AM', 390, 'Underwriting', 2510, 'Active'],
            ['Noel Daniel', 'Finance Officer', 'Finance', 'Today 10:02 AM', 304, 'Finance', 1800, 'Active'],
            ['Grace Emmanuel', 'Claims Auditor', 'Operations', 'Today 09:31 AM', 428, 'Claims', 2942, 'Active'],
            ['Moses Aliyu', 'Call Centre Agent', 'Call Centre', 'Yesterday 07:55 AM', 262, 'Call Centre', 1321, 'Active']
          ]
        },
        provider: {
          registered: 958, loggedIn: 811, approvalCodes: 4820, claims: 2414,
          actionChart: [4820, 2414, 640, 1022],
          table: [
            ['Reddington Hospital', 'Lagos', 'Today 09:22 AM', 288, 622, 312, 90, '13m 11s'],
            ['LifeBridge Clinic', 'Abuja', 'Today 08:41 AM', 231, 480, 201, 60, '11m 25s'],
            ['City Care Hospital', 'Rivers', 'Today 10:03 AM', 250, 505, 244, 54, '10m 18s'],
            ['Prime Medical Centre', 'Enugu', 'Yesterday 07:51 AM', 180, 311, 144, 49, '8m 42s']
          ]
        },
        enrollee: {
          appUsers: 11840, newSignups: 1880, returning: 9960, loggedIn: 9812,
          featureChart: [4680, 4400, 1710, 1280, 970, 800],
          table: [
            ['Aisha Bello', 'CJH00012', 'Android', 'Samsung A54', 'Today 09:40 AM', 129, 'Benefits', '10m 55s', 'Lagos'],
            ['Chinedu Obi', 'CJH00420', 'iOS', 'iPhone 13', 'Today 08:17 AM', 101, 'Benefits', '9m 04s', 'Abuja'],
            ['Mary Okon', 'CJH00188', 'Android', 'Redmi Note 12', 'Today 10:11 AM', 118, 'Telemedicine', '13m 40s', 'Rivers'],
            ['John James', 'CJH00291', 'iOS', 'iPhone 11', 'Today 07:42 AM', 78, 'Provider Search', '8m 06s', 'Lagos']
          ]
        },
        login: {
          attempts: 36288, success: 33120, failed: 3168, otp: 12240,
          loginChart: [33120, 3168],
          sessionChart: [10, 11, 10, 12, 11, 10, 12],
          table: [
            ['Aisha Bello', 'Enrollee', 'Android', 'Samsung A54', 'Today 09:40 AM', 'Today 09:52 AM', '12m', 'Success', '-'],
            ['LifeBridge Clinic', 'Provider', 'Web', 'Chrome', 'Today 08:41 AM', 'Today 08:54 AM', '13m', 'Success', '-'],
            ['Moses Aliyu', 'ERP Staff', 'Web', 'Edge', 'Yesterday 07:55 AM', '-', '-', 'Failed', 'Wrong OTP'],
            ['Chinedu Obi', 'Enrollee', 'iOS', 'iPhone 13', 'Today 08:17 AM', 'Today 08:26 AM', '9m', 'Success', '-']
          ]
        },
        dropoff: {
          highest: 'OTP Verification',
          rate: 17,
          completion: 83,
          funnel: 83,
          enrolleeSteps: [
            ['App Opened', 100],
            ['Login Started', 91],
            ['OTP Requested', 81],
            ['OTP Verified', 73],
            ['Dashboard Reached', 70],
            ['Action Completed', 58]
          ],
          providerSteps: [
            ['Portal Login', 100],
            ['Dashboard Reached', 94],
            ['Approval Code Started', 82],
            ['Services Added', 76],
            ['Submitted Successfully', 66]
          ],
          table: [
            ['OTP Login Process', 12240, 10159, 2081, '17%', 'OTP Verification Screen'],
            ['Telemedicine Booking', 1710, 1110, 600, '35%', 'Select Date / Time'],
            ['Approval Code Request', 4820, 4020, 800, '17%', 'Service Selection'],
            ['Claims Submission', 2414, 1912, 502, '21%', 'Upload Bills']
          ]
        },
        daily: {
          dashboard: 11480, providerSearch: 4400, telemedicine: 1710, chat: 800,
          trend: [6100, 6900, 7600, 8500, 9800, 10800, 11840],
          distribution: [4400, 4680, 1710, 800, 1290, 1950],
          table: [
            ['2026-04-03', 10220, 15110, 'Benefits', 'Profile Update', '10m', 2810, 291],
            ['2026-04-04', 10480, 15490, 'Provider Search', 'Chat Support', '10m', 2884, 300],
            ['2026-04-05', 10620, 15820, 'Benefits', 'Claims History', '11m', 2940, 282],
            ['2026-04-06', 10910, 16222, 'Benefits', 'Profile Update', '11m', 3010, 295],
            ['2026-04-07', 11140, 16580, 'Provider Search', 'Chat Support', '11m', 3098, 305],
            ['2026-04-08', 11400, 16990, 'Benefits', 'Claims History', '11m', 3162, 311],
            ['2026-04-09', 11840, 17420, 'Benefits', 'Profile Update', '12m', 3248, 318]
          ]
        },
        device: {
          android: 7735, ios: 4105, androidErrors: 198, iosErrors: 84,
          platformChart: [7735, 4105],
          versionChart: [3820, 3440, 2790, 1790],
          table: [
            ['Android', 'Samsung A54', '1.0.2', 'Android 14', 1840, 44, '11m'],
            ['Android', 'Redmi Note 12', '1.0.1', 'Android 13', 1610, 39, '10m'],
            ['iOS', 'iPhone 13', '1.0.2', 'iOS 18', 1730, 21, '12m'],
            ['iOS', 'iPhone 11', '1.0.1', 'iOS 17', 1260, 18, '9m']
          ]
        },
        reports: {
          summary: [
            'Over the last 90 days, mobile usage has grown strongly, especially on <strong>Android</strong>.',
            '<strong>Benefits</strong> remains the strongest used feature on the enrollee app.',
            'Provider portal activity is strong, with high approval code request volume.',
            'OTP verification has improved, but remains the biggest single drop-off point.'
          ],
          regional: [
            ['South West', 63, 312, 4420, 11840, '15%', 'Benefits'],
            ['North', 39, 201, 2650, 7280, '18%', 'Provider Search'],
            ['South South', 25, 161, 2380, 6610, '19%', 'Telemedicine'],
            ['South East', 18, 137, 2390, 7390, '18%', 'Benefits']
          ]
        }
      }
    };

export type StatisticsPeriod = keyof typeof METRICS_BY_PERIOD
export type StatisticsSnapshot = (typeof METRICS_BY_PERIOD)[StatisticsPeriod]
