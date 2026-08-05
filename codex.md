# CODEX.md
# ECG Telemetry Monitoring System

## Project Overview

This project is a web-based ECG Telemetry Monitoring System built for a Final Project (Tugas Akhir).

Tech Stack:

- Next.js 15 (App Router)
- React
- TypeScript
- TailwindCSS
- Firebase Authentication
- Firebase Realtime Database
- MQTT
- Recharts (current)
- Future migration to uPlot is acceptable if performance improvements are required.

---

# Important Rules

## DO NOT rewrite the project.

The project is already functional.

Do not replace working features.

Refactor only when necessary.

Always preserve existing behavior.

---

# System Concept

This project is NOT a Hospital Information System.

This project is an ECG Telemetry Monitoring System.

The primary entity is:

Device

NOT

Patient.

A device can be assigned to different patients over time.

The frontend may continue displaying patient information.

Internally every operation should always use:

deviceId

as the primary identifier.

---

# Existing Features

Already implemented.

- Firebase Authentication
- MQTT Realtime ECG
- 3 Lead ECG
- Recording
- Snapshot
- CSV Export
- Device Online Status
- ECG Chart
- Chart Speed
- Gain Adjustment
- Patient Information Card

These features should continue working after any modification.

---

# MQTT

Current topics

```
ecg/{deviceId}/realtime

devices/{deviceId}/status
```

DO NOT change these topics.

DO NOT modify payload structure unless absolutely required.

---

# Architecture

Current

```
Login

↓

Patient List

↓

Patient Detail

↓

Realtime ECG
```

Target

```
Login

↓

Dashboard

↓

Devices

↓

Realtime ECG
```

Frontend UI should remain visually similar.

---

# Device Assignment

The UI still displays:

- Patient Name
- Age
- Gender

Internally those values belong to:

Device Assignment

Each Device owns one active assignment.

Example

```
Device ECG001

↓

Assignment

Patient Name

Age

Gender

Doctor

Medical Record Number

Room
```

The card UI must remain unchanged.

Only the backend architecture changes.

---

# User Roles

Three roles exist.

## Master

Permissions

- Full Access
- Manage Users
- Manage Roles
- Manage Devices
- Manage Assignments
- Access Settings
- View ECG
- Record ECG
- Download Recordings

---

## Doctor

Permissions

- View Devices
- View ECG
- View Recording History
- Start Recording
- Stop Recording
- Save Snapshot
- Download CSV

Restrictions

Cannot

- Edit Assignment
- Create Assignment
- Delete Assignment
- Manage Users
- Access Settings

---

## Nurse

Permissions

Everything Doctor can do

PLUS

- Create Assignment
- Edit Assignment
- Remove Assignment

Restrictions

Cannot

- Manage Users
- Change Roles
- Access Settings

---

# Authentication

Continue using Firebase Authentication.

Workflow

```
Login

↓

Firebase Authentication

↓

UID

↓

users/{uid}

↓

role

↓

Load Application
```

---

# Users Collection

```
users

uid

displayName

email

role
```

Allowed roles

```
master

doctor

nurse
```

---

# Devices Collection

```
devices

deviceId

assignment

patientName

age

gender

doctor

medicalRecord

room

status

lastSeen

isRecording
```

---

# Records

```
records

recordId

deviceId

assignment

createdAt

data
```

Assignment information should be copied into the record when recording starts so historical records remain immutable.

---

# Navigation

## Master

- Dashboard
- Devices
- Users
- Reports
- Settings

## Doctor

- Dashboard
- Devices
- Reports

## Nurse

- Dashboard
- Devices

Navigation should be generated using permissions.

---

# Permission System

Never scatter checks like

```ts
if(role === "doctor")
```

Create

```
lib/permissions.ts
```

Example

```ts
export const permissions = {

    master: {
        canManageUsers: true,
        canManageAssignments: true,
        canAccessSettings: true,
        canRecord: true
    },

    doctor: {
        canManageUsers: false,
        canManageAssignments: false,
        canAccessSettings: false,
        canRecord: true
    },

    nurse: {
        canManageUsers: false,
        canManageAssignments: true,
        canAccessSettings: false,
        canRecord: true
    }

}
```

Components should rely on permission flags.

Never compare role strings throughout the application.

---

# Route Protection

Unauthorized pages should return

403 Access Denied

Do not rely only on hiding buttons.

Protect routes whenever possible.

---

# UI Rules

Keep the current UI.

Do NOT redesign

- ECG Chart
- Patient Card
- Dashboard Layout

Only improve

- Login
- Navigation
- Role-based menus
- User experience

Maintain a medical software appearance.

---

# Code Organization

Large files should be split.

Suggested hooks

```
hooks/

useAuth.ts

useRole.ts

usePermissions.ts

useMQTT.ts

useRecording.ts

useDeviceAssignment.ts
```

Suggested folders

```
components/

auth/

dashboard/

devices/

ecg/

layout/

navigation/
```

---

# Coding Standards

Always

- TypeScript Strict
- Reusable Components
- Small Components
- No duplicated logic
- SOLID principles when applicable
- Follow Next.js App Router best practices

Avoid

- Giant page.tsx files
- Hardcoded role checks
- Duplicate Firebase logic
- Duplicate MQTT listeners

---

# Performance

Do not introduce unnecessary rerenders.

Prefer

- useMemo
- useCallback
- React.memo

when appropriate.

Preserve current realtime ECG performance.

---

# Before Editing

Always inspect the existing implementation first.

Prefer extending existing components instead of rewriting them.

If an implementation already works, preserve it.

---

# Expected Workflow

For every task:

1. Analyze the existing implementation.
2. Explain the proposed solution.
3. Implement incrementally.
4. Explain what changed.
5. List modified files.
6. Avoid unrelated refactoring.

Never modify unrelated parts of the project.