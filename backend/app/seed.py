"""Seed initial data (users, sample complaints, notifications) into the database."""
from datetime import datetime

from app.ai.ml_pipeline import DEPARTMENT_MAP, generate_ai_analysis
from app.database import db
from app.security import hash_password


def seed_users() -> None:
    if db.count("users") > 0:
        return
    users = [
        {
            "id": "u1", "name": "Akash Rajan", "email": "citizen@demo.com",
            "role": "citizen", "phone": "+919876543210",
            "address": "12, Gandhi Nagar, Coimbatore - 641001",
            "joinedAt": "2024-03-15", "password_hash": hash_password("citizen123"),
        },
        {
            "id": "u4", "name": "Bala Murugan", "email": "bala@demo.com",
            "role": "citizen", "phone": "+919444411111",
            "address": "45, RS Puram, Coimbatore - 641002",
            "joinedAt": "2024-05-20", "password_hash": hash_password("citizen123"),
        },
        {
            "id": "u5", "name": "Arun Kumar", "email": "arun@demo.com",
            "role": "citizen", "phone": "+919555522222",
            "address": "78, Saibaba Colony, Coimbatore - 641011",
            "joinedAt": "2024-06-10", "password_hash": hash_password("citizen123"),
        },
        {
            "id": "u6", "name": "Aathi Selvan", "email": "aathi@demo.com",
            "role": "citizen", "phone": "+919666633333",
            "address": "23, Peelamedu, Coimbatore - 641004",
            "joinedAt": "2024-07-01", "password_hash": hash_password("citizen123"),
        },
        {
            "id": "u2", "name": "Priya Suresh", "email": "officer@demo.com",
            "role": "officer", "phone": "+918765432109",
            "address": "Coimbatore", "department": "Roads & Infrastructure",
            "joinedAt": "2023-08-20", "password_hash": hash_password("officer123"),
        },
        {
            "id": "u3", "name": "Admin Rajesh", "email": "admin@demo.com",
            "role": "admin", "phone": "+917654321098",
            "address": "Coimbatore", "joinedAt": "2022-01-10",
            "password_hash": hash_password("admin123"),
        },
    ]
    for u in users:
        db.insert("users", u)


def seed_complaints() -> None:
    if db.count("complaints") > 0:
        return
    samples = [
        {
            "id": "c1", "petitionId": "PET-2024-001",
            "title": "Large pothole on Anna Salai causing accidents",
            "description": "There is a massive pothole on Anna Salai near the bus stop that has caused two accidents this week. The road is severely damaged and needs immediate repair.",
            "category": "Road & Infrastructure", "location": "Anna Salai, Near Bus Stop No. 14",
            "district": "Coimbatore", "submittedBy": "u1", "submittedByName": "Akash Rajan",
            "status": "in_progress", "priority": "critical",
            "assignedDepartment": "Roads & Infrastructure", "assignedOfficer": "o1",
            "assignedOfficerName": "Priya Suresh",
            "submittedAt": "2024-08-10T09:30:00Z",
            "statusHistory": [
                {"status": "submitted", "timestamp": "2024-08-10T09:30:00Z", "note": "Complaint submitted by citizen", "updatedBy": "System"},
                {"status": "under_review", "timestamp": "2024-08-10T10:15:00Z", "note": "AI analysis completed. Routed to Roads & Infrastructure.", "updatedBy": "AI System"},
                {"status": "in_progress", "timestamp": "2024-08-12T11:30:00Z", "note": "Site visit completed. Repair scheduled.", "updatedBy": "Priya Suresh"},
            ],
        },
        {
            "id": "c2", "petitionId": "PET-2024-002",
            "title": "No water supply for 3 days in our area",
            "description": "Our entire street has had no water supply for the past 3 days. Families with small children are severely affected.",
            "category": "Water Supply", "location": "Gandhi Nagar, 5th Street",
            "district": "Coimbatore", "submittedBy": "u1", "submittedByName": "Akash Rajan",
            "status": "resolved", "priority": "high",
            "assignedDepartment": "Water Works", "assignedOfficer": "o2",
            "assignedOfficerName": "Venkat Kumar",
            "resolutionDetails": "Blocked pipeline cleared. Water supply restored.",
            "submittedAt": "2024-08-08T14:20:00Z",
            "statusHistory": [
                {"status": "submitted", "timestamp": "2024-08-08T14:20:00Z", "note": "Complaint submitted by citizen", "updatedBy": "System"},
                {"status": "resolved", "timestamp": "2024-08-10T16:00:00Z", "note": "Water supply restored after pipeline repair", "updatedBy": "Venkat Kumar"},
            ],
        },
        {
            "id": "c3", "petitionId": "PET-2024-003",
            "title": "Illegal construction blocking public road",
            "description": "A building under construction on Nehru Street has encroached on the public road causing severe traffic issues.",
            "category": "Building & Construction", "location": "Nehru Street, Near Post Office",
            "district": "Coimbatore", "submittedBy": "u4", "submittedByName": "Bala Murugan",
            "status": "under_review", "priority": "medium",
            "assignedDepartment": "Roads & Infrastructure",
            "submittedAt": "2024-08-12T16:45:00Z",
            "statusHistory": [
                {"status": "submitted", "timestamp": "2024-08-12T16:45:00Z", "note": "Complaint submitted by citizen", "updatedBy": "System"},
            ],
        },
        {
            "id": "c4", "petitionId": "PET-2024-004",
            "title": "Street lights not working for past 2 weeks",
            "description": "All street lights on KK Nagar main road have not been working for the past 2 weeks. The area is completely dark at night.",
            "category": "Electricity", "location": "KK Nagar Main Road",
            "district": "Coimbatore", "submittedBy": "u5", "submittedByName": "Arun Kumar",
            "status": "assigned", "priority": "high",
            "assignedDepartment": "Electricity Board", "assignedOfficer": "o3",
            "assignedOfficerName": "Rekha Devi",
            "submittedAt": "2024-08-09T19:00:00Z",
            "statusHistory": [
                {"status": "submitted", "timestamp": "2024-08-09T19:00:00Z", "note": "Complaint submitted by citizen", "updatedBy": "System"},
            ],
        },
    ]

    for s in samples:
        analysis = generate_ai_analysis(s["title"], s["description"], s.get("category"))
        s["aiAnalysis"] = analysis
        db.insert("complaints", s)


def seed_notifications() -> None:
    if db.count("notifications") > 0:
        return
    notifications = [
        {"id": "n1", "userId": "u1", "title": "Petition Submitted", "message": "Your petition PET-2024-001 has been submitted and AI analysis is complete.", "type": "success", "isRead": False, "timestamp": "2024-08-10T09:35:00Z", "petitionId": "PET-2024-001"},
        {"id": "n2", "userId": "u4", "title": "Petition Submitted", "message": "Your petition PET-2024-003 has been submitted and AI analysis is complete.", "type": "success", "isRead": False, "timestamp": "2024-08-12T16:50:00Z", "petitionId": "PET-2024-003"},
        {"id": "n3", "userId": "u5", "title": "Petition Submitted", "message": "Your petition PET-2024-004 has been submitted and AI analysis is complete.", "type": "success", "isRead": False, "timestamp": "2024-08-09T19:05:00Z", "petitionId": "PET-2024-004"},
    ]
    for n in notifications:
        db.insert("notifications", n)


def seed_all() -> None:
    seed_users()
    seed_complaints()
    seed_notifications()
    print(f"[PetitionAI] Seeded. MongoDB: {db.using_mongodb}")


if __name__ == "__main__":
    seed_all()