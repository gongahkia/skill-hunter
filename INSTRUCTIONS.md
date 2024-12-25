# Instructions

[Owl](https://github.com/gongahkia/owl) extensions all begin installation the same way.

1. Open [google suite](https://workspace.google.com/) application.
2. Select `Extensions > Apps Script`.

![](./asset/reference/reference-1.png)

3. Replace the code in `Code.gs`.

![](./asset/reference/reference-8.png)

5. `Ctrl + s` to save the project.
6. Select `Run`.
7. Select `OK` to give permissions.

![](./asset/reference/reference-3.png)

8. Choose a Google Account to associate with the script.

![](./asset/reference/reference-4.png)

9. Select `Show Advanced > Go to project_name (unsafe)`.

![](./asset/reference/reference-5.png)

10. Select `Allow`.

![](./asset/reference/reference-6.png)

> FUA TODO clean up the remaining instructions below as well

1. Do everything [here](./../INSTRUCTIONS.md) first.
2. Select `Triggers` in the left sidebar.

![](./../asset/scripts/create_sheets/reference-1.png)

3. Select `+ Add Trigger` at the bottom right corner.
4. Configure the trigger with the following.
    1. Choose which function to run: *createMonthlySheet*
    2. Choose which deployment should run: *Head*
    3. Select event source: *Time-driven*
    4. Time-based trigger: *Month timer* and *On the first day of the month*
5. Select `Save`.

![](./../asset/scripts/create_sheets/reference-2.png)
