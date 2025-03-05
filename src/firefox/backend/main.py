from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import subprocess
import json

app = FastAPI()

class Submission(BaseModel):
    solution: str
    question_id: str

# Mock LeetCode API (Replace with actual LeetCode API interaction)
leetcode_questions = {
    "1": {
        "question_title": "Two Sum",
        "question": "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
        "test_cases": [
            {"input": "[2, 7, 11, 15], 9", "output": "[0, 1]"},
        ],
        "correct_solution": "def twoSum(nums, target):\n    nums_map = {}\n    for i, num in enumerate(nums):\n        complement = target - num\n        if complement in nums_map:\n            return [nums_map[complement], i]\n        nums_map[num] = i\n    return []"
    }
}

@app.get("/leetcode/problem")
async def get_leetcode_problem():
    """Returns a LeetCode problem (mocked for now)."""
    question_id = "1"
    problem = leetcode_questions[question_id]
    return {"question": problem["question"], "question_title": problem["question_title"], "question_id": question_id}

@app.post("/leetcode/submit")
async def submit_leetcode_solution(submission: Submission):
    """Submits a solution to be checked."""
    question_id = submission.question_id
    if question_id not in leetcode_questions:
        raise HTTPException(status_code=404, detail="Question not found")
    problem = leetcode_questions[question_id]
    correct_solution = problem["correct_solution"]
    test_cases = problem["test_cases"]
    if submission.solution.strip() == correct_solution.strip():
        return {"success": True, "message": "Solution is correct!"}
    else:
        return {"success": False, "error": "Solution is incorrect."}