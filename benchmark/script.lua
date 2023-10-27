
randomseed = tonumber(
  tostring(
    math.ceil(os.time() / os.clock())
  ):reverse()
)
math.randomseed(randomseed)
math.random(); math.random(); math.random()

paths = {}
for path in io.lines('urls.txt') do
  paths[#paths + 1] = path
end

request = function()
  local index = math.random(#paths)
  local path = paths[index]
  return wrk.format('GET', path)
end