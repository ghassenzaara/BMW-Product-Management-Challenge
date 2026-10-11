-- PM-edited argument sheet of a requirement (markdown). Null = generated from the
-- requirement and its evidence. Evidence a PM adds by hand needs no schema change:
-- it is a source_record of the sources pm_upload / pm_link / pm_note (registered on
-- first use) and a signal that passes the validation gate like any other.
alter table requirement add column argument_md text;
