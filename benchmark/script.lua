
randomseed = tonumber(tostring(math.ceil(os.time() / os.clock())):reverse())
math.randomseed(randomseed)
math.random(); math.random(); math.random()

paths = {}
for path in io.lines('paths3.txt') do
  paths[#paths + 1] = path
end

--print('Count of paths: ' .. #paths)

request = function()
  local index = math.random(#paths)
  local path = paths[index]
  local headers = {
    ['x-api-key'] = '9e7f1D53edf0a5E9b259b3e679C65ec6'
  }
  --print('path ' .. path .. ' [' .. index .. '] ' .. headers['x-api-key'])
  return wrk.format('GET', path, headers)
end