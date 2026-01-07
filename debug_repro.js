// Native fetch is available in Node 18+

const links = [
    { text: "Class Timetable", href: "#timetable", category: "Academics" },
    { text: "Course Curriculum", href: "#curriculum", category: "Academics" },
    { text: "My Attendance", href: "#attendance", category: "Academics" },
    { text: "Grades & Results", href: "#grades", category: "Examinations" }, // Simulate 'Examinations' or 'Exam Scores' as user sees it
    { text: "Exam Schedule", href: "#exam-schedule", category: "Examinations" },
    { text: "Download Hall Ticket", href: "#hall-ticket", category: "Examinations" },
    { text: "Re-evaluation Request", href: "#reval", category: "Examinations" },
    { text: "Supplementary Registration", href: "#supple", category: "Examinations" },
    { text: "Hostel Booking", href: "#hostel", category: "Services" },
    { text: "Pay Tuition Fees", href: "#fee-payment", category: "Finance" },
    { text: "Scholarship Status", href: "#scholarships", category: "Finance" }
];

async function testQuery() {
    const query = "how to check results for sem 3";
    console.log(`Testing query: "${query}"`);

    try {
        const response = await fetch("http://localhost:3000/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                query,
                pageTitle: "Amrita Vishwa Vidyapeetham - Student Portal",
                links: links,
                apiKey: "AIzaSyB5MdbGmZpc7dx4d_eZynP0PeZGHx6zv4o" // Use known key
            })
        });

        const result = await response.json();
        console.log("Response:", JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("Error:", error);
    }
}

testQuery();
