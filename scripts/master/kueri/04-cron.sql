select format('select cron.schedule(%L, %L, %L);', jobname, schedule, command)
from cron.job where jobname is not null order by jobname;
