from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import ast

app = FastAPI()

class Submission(BaseModel):
    solution: str
    function_name: str
    test_cases: list

def run_code_safely(code, function_name, test_case):
    try:
        ast.parse(code)
        restricted_globals = {"__builtins__": {}}
        exec(code, restricted_globals)
        user_function = restricted_globals.get(function_name)
        if not user_function:
            raise ValueError(f"Function '{function_name}' not found in the submitted code")
        return user_function(*test_case)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/leetcode/submit")
async def submit_leetcode_solution(submission: Submission):
    for i, test_case in enumerate(submission.test_cases):
        result = run_code_safely(submission.solution, submission.function_name, test_case["input"])
        if result != test_case["output"]:
            return {"success": False, "message": f"Failed on test case {i + 1}. Expected {test_case['output']}, but got {result}"}
    
    return {"success": True, "message": "All test cases passed!"}